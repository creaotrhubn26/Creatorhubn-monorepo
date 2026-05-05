import SwiftUI
import UIKit
import AVFoundation

// MARK: - Root

/// Live tethered-capture surface for iPad. Three first-class states:
/// (a) disconnected — focused connect CTA; (b) connecting — calm progress;
/// (c) connected — hero + filmstrip + shutter. Designed for on-set use:
/// dark background, large touch targets, persistent status glance.
struct LiveCaptureView: View {
    @State private var model = LiveCaptureModel()
    @State private var auth = SignInService.shared
    @State private var isProjectSelectionPresented = false
    @State private var isShotListPresented = false
    @State private var isCoverageDashboardPresented = false
    @State private var coverageDashboardSessionId: UUID?
    @AppStorage("capture.lastCameraURL") private var lastCameraURL: String = "https://192.168.1.2"
    @State private var isSettingsPresented = false
    @State private var isTunePresented = false
    @State private var isDeliverPresented = false
    @State private var isArchivePresented = false
    @State private var isSignInPresented = false
    @State private var isReviewInboxPresented = false
    @State private var viewerAsset: Asset?
    /// Slice 7 — when set, presents DetectionReviewSheet for that
    /// asset's pending detections. Cleared on dismiss / confirm. The
    /// filmstrip doubleTap routes here instead of `viewerAsset` when
    /// the asset has pending detections — once confirmed, doubleTap
    /// behaves normally (asset no longer has pending).
    @State private var pendingReviewAsset: Asset?

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
                showHUD: model.showHUD,
                onToggleHUD: { model.showHUD.toggle() },
                autoCleanMode: model.autoCleanMode,
                onSetAutoCleanMode: { model.autoCleanMode = $0 },
                clientReviewsEnabled: model.clientReviewsEnabled,
                onToggleClientReviews: { model.clientReviewsEnabled.toggle() },
                deliveryColorProfileTag: model.deliveryColorProfileTag,
                onSetDeliveryColorProfile: { tag in
                    model.deliveryColorProfileTag = tag
                },
                onRename: { newName in
                    Task { await model.renameSession(newName) }
                },
                onDisconnect: {
                    isSettingsPresented = false
                    Task { await model.disconnect() }
                },
                onSignIn: {
                    isSettingsPresented = false
                    isSignInPresented = true
                }
            )
            .environment(auth)
            .presentationDetents([.medium, .large])
        }
        .fullScreenCover(item: $viewerAsset) { asset in
            AssetViewerScreen(
                assets: model.assets,
                initialAssetId: asset.id,
                onClose: { viewerAsset = nil }
            )
        }
        .sheet(item: $pendingReviewAsset) { asset in
            // Slice 7 — review sheet for pending detections. Bound to
            // the asset id; the model re-fetches the latest asset each
            // body to pick up any pendingDetections changes from
            // AutoCleanService that arrived between dispatch and render.
            DetectionReviewSheet(
                asset: model.assets.first(where: { $0.id == asset.id }) ?? asset,
                onConfirm: { selectedIds in
                    pendingReviewAsset = nil
                    Task { await model.commitPendingDetections(assetId: asset.id, selected: selectedIds) }
                },
                onDismiss: {
                    pendingReviewAsset = nil
                },
            )
            .presentationDetents([.medium, .large])
        }
        .sheet(isPresented: $isTunePresented) {
            if let asset = model.focusedAsset {
                TunePanel(
                    initialRecipe: model.recipe(for: asset.id),
                    onChange: { model.tune(assetId: asset.id, recipe: $0) },
                    onReset: { model.resetRecipe(assetId: asset.id) },
                    onApplyToScope: { scope in
                        model.applyRecipeToSelection(
                            recipe: model.recipe(for: asset.id),
                            scope: scope,
                            sourceAssetId: asset.id,
                        )
                    },
                    assetCounts: TunePanel.ScopeCounts(
                        flagged: LiveCaptureModel.RecipeApplyScope.allFlagged.count(in: model.assets),
                        fourPlus: LiveCaptureModel.RecipeApplyScope.allFourPlus.count(in: model.assets),
                        entireSession: LiveCaptureModel.RecipeApplyScope.entireSession.count(in: model.assets),
                    ),
                )
                // Drawer-style presentation: small detent (35%) lets
                // the photographer keep the hero photo visible while
                // dragging sliders, medium (~50%) gives more room when
                // diving into many axes, large covers full-screen for
                // full preset browsing. Interaction-passthrough means
                // the photo behind responds to swipes/zoom in the small
                // and medium detents — so colour-tweak feedback is
                // immediately visible without dismissing the panel.
                .presentationDetents([.fraction(0.35), .medium, .large])
                .presentationBackgroundInteraction(
                    .enabled(upThrough: .medium)
                )
                .presentationDragIndicator(.visible)
                .interactiveDismissDisabled(false)
            }
        }
        .sheet(isPresented: $isDeliverPresented) {
            DeliverSheet(model: model)
                .environment(auth)
                .presentationDetents([.large])
        }
        .sheet(isPresented: $isArchivePresented) {
            SessionsArchiveSheet(model: model)
                .presentationDetents([.large])
        }
        .sheet(isPresented: $isReviewInboxPresented, onDismiss: {
            // Close = read. Per-tile filmstrip badges remain so the
            // photographer keeps the "this shot got feedback" signal
            // after the bell badge clears.
            model.markReviewsRead()
        }) {
            ReviewInboxSheet(
                reviews: model.recentClientReviews,
                onSelectReview: { review in
                    model.focusedAssetId = review.assetId
                    isReviewInboxPresented = false
                },
                onOpenSideBySide: {
                    isReviewInboxPresented = false
                    model.enterReviewMode()
                },
                onDismiss: { isReviewInboxPresented = false }
            )
            .presentationDetents([.medium, .large])
        }
        .sheet(isPresented: $isSignInPresented) {
            // SignInView is navigation-free by design — wrap it in our
            // own NavigationStack here so the sheet presentation gets a
            // title bar + a close affordance. The onboarding sign-in
            // step supplies its own title and doesn't need this wrapper.
            NavigationStack {
                SignInView()
                    .navigationTitle("Logg inn")
                    .navigationBarTitleDisplayMode(.inline)
                    .toolbar {
                        ToolbarItem(placement: .topBarTrailing) {
                            Button("Lukk") { isSignInPresented = false }
                        }
                    }
            }
            .environment(auth)
            .presentationDetents([.large])
        }
        .sheet(isPresented: $isProjectSelectionPresented) {
            ProjectSelectionView { summary in
                model.selectProject(summary)
            }
            .environment(auth)
            .presentationDetents([.large])
        }
        .sheet(isPresented: $isShotListPresented) {
            ShotListPanel(model: model)
                .presentationDetents([.large])
        }
        .sheet(isPresented: $isCoverageDashboardPresented) {
            // Build the dashboard model fresh per-presentation so it
            // re-fetches when re-opened (catches assets uploaded since
            // last time). Project ID + (lazy) backend session ID flow
            // straight from LiveCaptureModel — no manual paste-fields.
            if let projectId = model.selectedProject?.id,
               let backend = model.currentBackendClient {
                NavigationStack {
                    LiveSetDashboardView(
                        model: LiveSetDashboardModel(
                            backend: backend,
                            projectId: projectId,
                            sessionId: coverageDashboardSessionId,
                        ),
                    )
                    .toolbar {
                        ToolbarItem(placement: .topBarTrailing) {
                            Button("Lukk") { isCoverageDashboardPresented = false }
                        }
                    }
                }
                .presentationDetents([.large])
            }
        }
        .animation(.spring(duration: 0.35, bounce: 0.1), value: model.phase)
        .task {
            // Screenshot/dev convenience — `--auto-demo` at launch wires
            // straight into Demo Mode so the disconnected overlay never
            // shows. `--auto-demo-shots=N` (default 3) follows up with N
            // shutter triggers spaced 1.5 s apart so the connected UI
            // has assets to render. Used to capture screenshots without
            // driving the simulator through manual taps.
            if ProcessInfo.processInfo.arguments.contains("--auto-demo"),
               model.phase == .disconnected,
               !model.isConnecting {
                await model.connect(to: LiveCaptureModel.demoBaseURL)
                // Wait for connection to settle before firing.
                try? await Task.sleep(for: .milliseconds(800))
                let shotsArg = ProcessInfo.processInfo.arguments
                    .first { $0.hasPrefix("--auto-demo-shots=") }
                let shotCount = shotsArg
                    .flatMap { Int($0.dropFirst("--auto-demo-shots=".count)) }
                    ?? 3
                for _ in 0..<shotCount {
                    await model.triggerShutter()
                    try? await Task.sleep(for: .milliseconds(1500))
                }
                // Inject demo client reviews so the bell + per-tile
                // badges + review-mode side rail have content to show
                // in screenshots. Two events: one heart on the second
                // shot (so the tile gets a comment-bubble badge AND
                // the bell shows unread count), one comment on the
                // last shot. Skipped when --no-demo-reviews is passed
                // or reviews are disabled in Settings.
                let suppressReviews = ProcessInfo.processInfo.arguments.contains("--no-demo-reviews")
                if !suppressReviews,
                   model.clientReviewsEnabled,
                   model.assets.count >= 2 {
                    try? await Task.sleep(for: .milliseconds(400))
                    let second = model.assets[model.assets.count - 2]
                    let last = model.assets.last!
                    model.injectDemoReview(
                        assetId: second.id,
                        assetFilename: second.originalFilename,
                        kind: .heart(on: true),
                        senderKind: .client,
                        displayName: "Holy Crust",
                    )
                    try? await Task.sleep(for: .milliseconds(300))
                    model.injectDemoReview(
                        assetId: last.id,
                        assetFilename: last.originalFilename,
                        kind: .comment(preview: "Elsker denne — bruk den som hovedbilde på Insta? Litt mer rom over toppen hvis mulig."),
                        senderKind: .client,
                        displayName: "Holy Crust",
                    )
                    // Photographer's reply lands a moment later so the
                    // demo screenshot shows actual two-way conversation
                    // (chat bubbles aligning to alternating sides).
                    try? await Task.sleep(for: .milliseconds(400))
                    model.injectDemoReview(
                        assetId: last.id,
                        assetFilename: last.originalFilename,
                        kind: .comment(preview: "Skal fikses — sender en ny crop om litt 👍"),
                        senderKind: .photographer,
                        displayName: "Daniel",
                    )
                    try? await Task.sleep(for: .milliseconds(300))
                    model.injectDemoReview(
                        assetId: last.id,
                        assetFilename: last.originalFilename,
                        kind: .comment(preview: "Perfekt, takk!"),
                        senderKind: .client,
                        displayName: "Holy Crust",
                    )
                }

                // `--auto-fullscreen` opens the AssetViewerScreen on the
                // latest asset once shots have landed. Lets screenshot
                // capture pick up the fill-the-screen behavior + swipe
                // pager without driving the simulator through manual
                // taps.
                if ProcessInfo.processInfo.arguments.contains("--auto-fullscreen") {
                    try? await Task.sleep(for: .milliseconds(500))
                    if let latest = model.assets.last {
                        viewerAsset = latest
                    }
                }
                // `--auto-review-mode` enters the split-pane review
                // mode on the latest reviewed asset, so screenshots
                // capture the full client-feedback workflow surface.
                if ProcessInfo.processInfo.arguments.contains("--auto-review-mode") {
                    try? await Task.sleep(for: .milliseconds(400))
                    model.enterReviewMode()
                }
                // `--auto-tune` opens the Magic · Tune sheet on the
                // latest enhanced asset for screenshot capture of the
                // redesigned panel (presets + sections + zero-tick).
                if ProcessInfo.processInfo.arguments.contains("--auto-tune"),
                   model.focusedAsset?.enhancedKey != nil {
                    try? await Task.sleep(for: .milliseconds(500))
                    isTunePresented = true
                }
            }
        }
    }

    private var connectedLayout: some View {
        VStack(spacing: 0) {
            StatusBar(
                state: model.connectionState,
                device: model.deviceSummary,
                telemetry: model.telemetry,
                pinnedFocus: model.pinnedFocus,
                pickCount: model.deliverablePicksCount,
                canDeliver: model.canDeliver,
                projectTitle: model.selectedProject?.title,
                shotListProgress: model.selectedProject?.shotListSummary.map {
                    .init(completed: $0.completedShots, total: $0.totalShots)
                },
                unreadReviewCount: model.unreadReviewCount,
                clientReviewsEnabled: model.clientReviewsEnabled,
                presentPeers: model.presentPeers,
                onTogglePin: { model.pinnedFocus.toggle() },
                onPickProject: { isProjectSelectionPresented = true },
                onShotList: { isShotListPresented = true },
                onCoverageDashboard: {
                    // Resolve the (possibly-nil) backend session ID
                    // before presenting so the dashboard receives the
                    // freshest value — DeliveryService.backendSessionId
                    // can flip from nil → set the moment a delivery
                    // starts, even mid-shoot.
                    Task {
                        coverageDashboardSessionId = await model.currentBackendSessionId()
                        isCoverageDashboardPresented = true
                    }
                },
                onDeliver: { isDeliverPresented = true },
                onArchive: { isArchivePresented = true },
                onReviewInbox: { isReviewInboxPresented = true },
                onSettings: { isSettingsPresented = true }
            )
            .padding(.horizontal, 24)
            .padding(.vertical, 12)

            Divider().background(Color.captureSeparator)

            ZStack {
                if model.isReviewMode, let focused = model.focusedAsset {
                    ReviewModeStage(
                        asset: focused,
                        reviewsForAsset: model.recentClientReviews
                            .filter { $0.assetId == focused.id },
                        allReviews: model.recentClientReviews,
                        replyMemosDirectory: model.replyMemosDirectory
                            ?? FileManager.default.temporaryDirectory,
                        onSelectAnotherAsset: { id in
                            model.focusedAssetId = id
                        },
                        onExit: { model.exitReviewMode() },
                        onOpenFullscreen: { asset in viewerAsset = asset },
                        onSendReply: { text in
                            model.sendPhotographerReply(assetId: focused.id, comment: text)
                        },
                        onSendVoiceReply: { url, duration in
                            model.sendPhotographerVoiceReply(
                                assetId: focused.id, audioURL: url, durationSeconds: duration,
                            )
                        }
                    )
                } else if model.isComparing,
                   let anchor = model.compareAnchorAsset,
                   let candidate = model.focusedAsset {
                    CompareHeroStage(
                        anchor: anchor,
                        candidate: candidate,
                        onExit: { model.exitCompare() },
                        onSwap: {
                            // Promote candidate to anchor: B becomes the
                            // new A, A becomes the new B (focused).
                            let newAnchorId = candidate.id
                            let newFocusId = anchor.id
                            model.compareAnchorAssetId = newAnchorId
                            model.focusedAssetId = newFocusId
                        }
                    )
                } else {
                    HeroStage(
                        asset: model.focusedAsset,
                        recipe: model.focusedAsset.map { model.recipe(for: $0.id) } ?? .neutral,
                        recipeSource: model.focusedAsset.map { model.recipeSource[$0.id] ?? .baseline } ?? .baseline,
                        analysis: model.showHUD ? model.focusedAnalysis : nil,
                        aiAnalysis: model.focusedAsset.flatMap { model.aiAnalyses[$0.id] },
                        aiNotesDismissed: model.focusedAsset.map { model.dismissedNoteAssets.contains($0.id) } ?? false,
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
                        },
                        onSetColor: { label in
                            guard let id = model.focusedAsset?.id else { return }
                            Task { await model.setColorLabel(assetId: id, label: label) }
                        },
                        voiceMemoState: model.voiceMemoService?.state ?? .idle,
                        voiceMemoExists: model.focusedAsset?.voiceMemoKey != nil,
                        onStartVoiceMemo: {
                            guard let id = model.focusedAsset?.id else { return }
                            model.startVoiceMemoRecording(assetId: id)
                        },
                        onStopVoiceMemo: {
                            guard let id = model.focusedAsset?.id else { return }
                            model.stopVoiceMemoRecording(assetId: id)
                        },
                        onPlayVoiceMemo: {
                            guard let id = model.focusedAsset?.id else { return }
                            model.toggleVoiceMemoPlayback(assetId: id)
                        },
                        onDeleteVoiceMemo: {
                            guard let id = model.focusedAsset?.id else { return }
                            model.deleteVoiceMemo(assetId: id)
                        },
                        onDismissNotes: {
                            guard let id = model.focusedAsset?.id else { return }
                            model.dismissNotes(assetId: id)
                        }
                    )
                    .onChange(of: model.focusedAssetId) { _, _ in
                        model.refreshAnalysis(for: model.focusedAsset)
                    }
                    .onChange(of: model.focusedAsset?.previewKey) { _, _ in
                        model.refreshAnalysis(for: model.focusedAsset)
                    }
                }
                ShutterFlashOverlay(trigger: model.shutterFlashToken)
                    .allowsHitTesting(false)
            }
            .frame(maxHeight: .infinity)

            TelemetryFooter(telemetry: model.telemetry)

            VStack(spacing: 0) {
                FilmstripFilterBar(
                    current: model.filmstripFilter,
                    currentColor: model.filmstripColorFilter,
                    counts: FilmstripFilterBar.Counts(
                        total: model.assets.count,
                        picks: model.assets.filter { $0.flaggedForClient && !$0.rejected }.count,
                        fourPlus: model.assets.filter { $0.rating >= 4 && !$0.rejected }.count
                    ),
                    colorCounts: Dictionary(
                        grouping: model.assets.compactMap { $0.colorLabel },
                        by: { $0 }
                    ).mapValues(\.count),
                    onSelect: { model.filmstripFilter = $0 },
                    onSelectColor: { model.filmstripColorFilter = $0 }
                )
                FilmstripRail(
                    assets: model.filteredAssets,
                    focusedAssetId: model.focusedAssetId,
                    compareAnchorId: model.compareAnchorAssetId,
                    assetIdsWithReviews: model.clientReviewsEnabled
                        ? model.assetIdsWithReviews
                        : [],
                    onSelect: { model.focusedAssetId = $0.id },
                    onDoubleTap: { asset in
                        // Slice 7 — route to DetectionReviewSheet when
                        // there are pending detections; once committed,
                        // doubleTap opens the viewer normally.
                        if let pending = asset.pendingDetections, !pending.isEmpty {
                            pendingReviewAsset = asset
                        } else {
                            viewerAsset = asset
                        }
                    },
                    onLongPress: { asset in
                        // Long-press anchors A-side; if user long-presses
                        // the anchor again, exit compare. If they
                        // long-press the currently-focused asset (no B
                        // would exist), bump focus to the previous asset
                        // so the compare panel has both sides ready.
                        if model.compareAnchorAssetId == asset.id {
                            model.exitCompare()
                        } else {
                            model.compareAnchorAssetId = asset.id
                            if model.focusedAssetId == asset.id,
                               let other = model.assets.first(where: { $0.id != asset.id }) {
                                model.focusedAssetId = other.id
                            }
                        }
                    }
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
                Image("CreatorHubOneLogo")
                    .resizable()
                    .scaledToFit()
                    .frame(width: 96, height: 96)
                    .accessibilityLabel("CreatorHub One")
                Text("CreatorHub One")
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
                    Text("Local-network permission was denied. Enable it in Settings → CreatorHub One → Local Network to find cameras automatically.")
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

    /// Phase 5.3 — deterministic per-userId avatar tint. Hashes the
    /// userId and picks from a small palette so the same peer always
    /// renders the same color in the StatusBar (predictable identity
    /// across reconnects + multi-iPad).
    static func peerAvatar(for userId: String) -> Color {
        let palette: [Color] = [
            .blue, .purple, .indigo, .teal, .green, .orange, .pink, .brown,
        ]
        var hash: UInt64 = 5381
        for byte in userId.utf8 {
            hash = ((hash << 5) &+ hash) &+ UInt64(byte)
        }
        return palette[Int(hash % UInt64(palette.count))]
    }

    /// Stable mapping from `ColorLabel` enum values to display colors.
    /// The model exposes 8 buckets (Lightroom standard 5 + 3 extras);
    /// we keep the picker visually consistent so a "green" set in one
    /// session looks the same across all surfaces.
    static func from(colorLabel: ColorLabel) -> Color {
        switch colorLabel {
        case .red:    return .red
        case .orange: return .orange
        case .yellow: return .yellow
        case .green:  return .green
        case .blue:   return .blue
        case .purple: return .purple
        case .pink:   return .pink
        case .gray:   return .gray
        }
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
    let pickCount: Int
    let canDeliver: Bool
    let projectTitle: String?
    let shotListProgress: ShotListProgress?
    let unreadReviewCount: Int
    let clientReviewsEnabled: Bool
    let presentPeers: [LiveCaptureModel.PresentPeer]
    let onTogglePin: () -> Void
    let onPickProject: () -> Void
    let onShotList: () -> Void
    let onCoverageDashboard: () -> Void
    let onDeliver: () -> Void
    let onArchive: () -> Void
    let onReviewInbox: () -> Void
    let onSettings: () -> Void

    struct ShotListProgress: Equatable {
        let completed: Int
        let total: Int
    }

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

            // Active project pill — always visible so the photographer
            // can confirm at a glance which CreatorHub project this
            // session is feeding. Tap to swap project.
            Button(action: onPickProject) {
                HStack(spacing: 6) {
                    Image(systemName: projectTitle == nil ? "folder.badge.plus" : "folder.fill")
                        .font(.caption.weight(.semibold))
                    Text(projectTitle ?? "No project")
                        .font(.caption.weight(.semibold))
                        .lineLimit(1)
                        .truncationMode(.middle)
                }
                .foregroundStyle(projectTitle == nil ? .secondary : .primary)
                .padding(.horizontal, 10)
                .padding(.vertical, 6)
                .background(
                    (projectTitle == nil ? Color.secondary : Color.accentColor).opacity(0.18),
                    in: Capsule()
                )
                .overlay(Capsule().stroke(
                    (projectTitle == nil ? Color.secondary : Color.accentColor).opacity(0.5),
                    lineWidth: 1
                ))
            }
            .buttonStyle(.plain)
            .help(projectTitle == nil ? "Pick a CreatorHub project" : "Switch project")

            if let progress = shotListProgress {
                Button(action: onShotList) {
                    HStack(spacing: 6) {
                        Image(systemName: "checklist")
                            .font(.caption.weight(.semibold))
                        Text("\(progress.completed)/\(progress.total)")
                            .font(.caption.monospaced().weight(.semibold))
                    }
                    .foregroundStyle(.primary)
                    .padding(.horizontal, 10).padding(.vertical, 6)
                    .background(Color.green.opacity(0.18), in: Capsule())
                    .overlay(Capsule().stroke(Color.green.opacity(0.5), lineWidth: 1))
                }
                .buttonStyle(.plain)
                .help("Open shot list")
            } else if projectTitle != nil {
                Button(action: onShotList) {
                    Image(systemName: "checklist")
                        .font(.body)
                        .frame(width: 36, height: 36)
                        .foregroundStyle(.secondary)
                }
                .buttonStyle(.plain)
                .help("Open shot list")
            }

            // Coverage dashboard — visual grid of shot-list vs. captured
            // assets. Only meaningful when a project is picked, since
            // the dashboard joins shot-list against the project.
            if projectTitle != nil {
                Button(action: onCoverageDashboard) {
                    Image(systemName: "square.grid.3x3")
                        .font(.body)
                        .frame(width: 36, height: 36)
                        .foregroundStyle(.secondary)
                }
                .buttonStyle(.plain)
                .help("Live Set dekningsgrid")
            }

            if let files = telemetry.totalContentsCount {
                Label("\(files) on card", systemImage: "sdcard")
                    .font(.caption.weight(.medium))
                    .foregroundStyle(.secondary)
            }

            // Phase 5.3 — multi-photographer presence row. Avatars
            // (initial-letter colored circles) for every other
            // photographer currently on this session. Hidden when
            // solo (no point rendering an empty space). Single iPad
            // shoots are the common case so the StatusBar stays
            // uncluttered.
            if !presentPeers.isEmpty {
                PresenceAvatarRow(peers: presentPeers)
            }

            // Client review inbox — peripheral surface for hearts +
            // comments arriving from the delivered web gallery while
            // the photographer is mid-shoot. Bell icon stays muted by
            // default; only the orange dot signals unread feedback so
            // the photographer can keep eyes on the camera. Tap opens
            // the chronological inbox, which marks all as read on
            // dismiss. Per-tile heart/comment badges (added in
            // FilmstripTile) carry the "this shot got feedback"
            // signal forward even after the inbox is opened. Hidden
            // entirely when the photographer disables reviews via
            // Settings — that's the "I want quiet" mode.
            if clientReviewsEnabled {
            Button(action: onReviewInbox) {
                Image(systemName: "bell")
                    .font(.body)
                    .frame(width: 36, height: 36)
                    .foregroundStyle(unreadReviewCount > 0 ? .primary : .secondary)
                    .overlay(alignment: .topTrailing) {
                        if unreadReviewCount > 0 {
                            Text("\(min(unreadReviewCount, 99))")
                                .font(.system(size: 10, weight: .heavy).monospacedDigit())
                                .foregroundStyle(.white)
                                .padding(.horizontal, 5)
                                .padding(.vertical, 1)
                                .background(.orange, in: Capsule())
                                .offset(x: 6, y: -4)
                        }
                    }
            }
            .buttonStyle(.plain)
            .help(unreadReviewCount > 0
                  ? "\(unreadReviewCount) new client review\(unreadReviewCount == 1 ? "" : "s") — tap to review"
                  : "Client review inbox")
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

            // Deliver — only enabled when there are picks AND a backend
            // is configured. Disabled state explains via help text.
            Button(action: onDeliver) {
                HStack(spacing: 6) {
                    Image(systemName: "paperplane.fill")
                        .font(.caption.weight(.semibold))
                    Text("Deliver")
                        .font(.caption.weight(.semibold))
                    if pickCount > 0 {
                        Text("\(pickCount)")
                            .font(.caption2.weight(.bold).monospaced())
                            .padding(.horizontal, 6)
                            .padding(.vertical, 2)
                            .background(Color.accentColor.opacity(0.25), in: Capsule())
                    }
                }
                .foregroundStyle(canDeliver ? .primary : .secondary)
                .padding(.horizontal, 12)
                .padding(.vertical, 6)
                .background(canDeliver ? Color.accentColor.opacity(0.18) : Color.clear, in: Capsule())
                .overlay(Capsule().stroke(canDeliver ? Color.accentColor.opacity(0.6) : .secondary.opacity(0.3), lineWidth: 1))
            }
            .buttonStyle(.plain)
            .disabled(!canDeliver)
            .help(canDeliver
                  ? "Mint a client share link for picks"
                  : "Need backend configured + at least one picked or 4★ shot")

            Button(action: onArchive) {
                Image(systemName: "tray.full")
                    .font(.title3)
                    .frame(width: 36, height: 36)
            }
            .buttonStyle(.plain)
            .foregroundStyle(.secondary)
            .help("Browse past sessions")

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
    let recipeSource: LiveCaptureModel.RecipeSource
    let analysis: ImageAnalysis?
    let aiAnalysis: BackendPhotoAnalysis?
    let aiNotesDismissed: Bool
    let showMagic: Bool
    let onTap: (Asset) -> Void
    let onToggleMagic: () -> Void
    let onOpenTune: () -> Void
    let onSetRating: (Int) -> Void
    let onTogglePick: () -> Void
    let onToggleReject: () -> Void
    let onSetColor: (ColorLabel?) -> Void
    let voiceMemoState: VoiceMemoService.State
    let voiceMemoExists: Bool
    let onStartVoiceMemo: () -> Void
    let onStopVoiceMemo: () -> Void
    let onPlayVoiceMemo: () -> Void
    let onDeleteVoiceMemo: () -> Void
    let onDismissNotes: () -> Void

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
                        .overlay(alignment: .topLeading) {
                            if let analysis {
                                HUDOverlay(analysis: analysis)
                                    .padding(.top, 28)
                                    .padding(.leading, 36)
                                    .allowsHitTesting(false)
                            }
                        }

                    // Recipe chips — show exactly what Magic is doing so
                    // the photographer can tune deliberately rather than
                    // trust an opaque preset. Tap to open the slider panel.
                    // Always surfaced (even when recipe is entirely neutral)
                    // so the Tune entry point is reliably reachable.
                    if asset.enhancedKey != nil {
                        Button(action: onOpenTune) {
                            RecipeChipsRow(chips: recipe.displayChips, source: recipeSource)
                        }
                        .buttonStyle(.plain)
                    }

                    // Claude Vision quality observations — eyes closed,
                    // motion blur, clipped highlights. The photographer
                    // can act on these in-camera before moving on.
                    if let aiAnalysis,
                       !aiNotesDismissed,
                       !aiAnalysis.qualityNotes.isEmpty {
                        AIQualityNotesRow(
                            notes: aiAnalysis.qualityNotes,
                            onDismiss: onDismissNotes
                        )
                        .padding(.horizontal, 24)
                    }

                    // Suggested caption — copy-to-clipboard pill for
                    // delivery / metadata workflow. Hidden when blank.
                    if let aiAnalysis,
                       !aiAnalysis.captionSuggestion.isEmpty {
                        AICaptionRow(caption: aiAnalysis.captionSuggestion)
                            .padding(.horizontal, 24)
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
                        Divider().frame(height: 20)
                        ColorLabelControls(
                            current: asset.colorLabel,
                            onSet: onSetColor
                        )
                        Divider().frame(height: 20)
                        VoiceMemoControls(
                            assetId: asset.id,
                            state: voiceMemoState,
                            memoExists: voiceMemoExists,
                            onStart: onStartVoiceMemo,
                            onStop: onStopVoiceMemo,
                            onPlay: onPlayVoiceMemo,
                            onDelete: onDeleteVoiceMemo
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
    /// **Phase 5.4** — When the server-AI-enhanced version has been
    /// downloaded (`asset.serverEnhancedKey` populated), default to
    /// showing it because it's higher quality than the iPad-rendered
    /// `enhancedKey` (full resolution, server has more compute headroom
    /// + can use Adobe DNG profiles + larger Bilateral radius). Toggle
    /// on the hero overlay lets the photographer flip back to the iPad
    /// version for comparison.
    @State private var preferServerAI: Bool = true

    /// Re-render token: changes every time the underlying enhanced file is
    /// rewritten (MagicPipeline.retune writes to the same path, so without
    /// this SwiftUI caches the stale image).
    private var reloadToken: String {
        // Include the chosen-enhanced-key in the token so SwiftUI rebuilds
        // when the photographer flips preferServerAI.
        let chosen = chosenEnhancedKey ?? "none"
        return "\(asset.id.uuidString)-\(asset.updatedAt.timeIntervalSince1970)-\(chosen.suffix(40))"
    }

    /// Resolves which enhanced-image path to show. When the server-AI
    /// variant is available AND the photographer hasn't flipped the
    /// toggle off, prefer it. Otherwise fall back to the iPad-rendered
    /// `enhancedKey` (always present once Magic has run). Returns nil
    /// when no enhanced version exists yet.
    private var chosenEnhancedKey: String? {
        if preferServerAI, let server = asset.serverEnhancedKey {
            return server
        }
        return asset.enhancedKey
    }

    /// Both versions are populated → show the toggle chip. iPad-only
    /// or server-only doesn't expose the toggle (nothing to flip
    /// between).
    private var bothEnhancedAvailable: Bool {
        asset.enhancedKey != nil && asset.serverEnhancedKey != nil
    }

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
               let enhancedKey = chosenEnhancedKey {
                ComparisonSlider(originalPath: originalKey, enhancedPath: enhancedKey)
                    .id(reloadToken)  // rebuild when bytes on disk change
                    .clipShape(RoundedRectangle(cornerRadius: 14))
                    .shadow(radius: 20, y: 8)
                    .overlay(alignment: .topTrailing) {
                        if bothEnhancedAvailable {
                            serverAIToggleChip
                        }
                    }
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
                        .id(reloadToken)
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

    /// **Phase 5.4** — Toggle chip overlay shown when both iPad-rendered
    /// and server-AI-rendered enhanced versions exist. Tap flips
    /// `preferServerAI` which triggers a re-render via the reloadToken.
    /// Visual: small pill in the top-right corner with "Server AI" or
    /// "iPad" label + a flip icon, matching the rest of the chip
    /// vocabulary in the live capture surface.
    private var serverAIToggleChip: some View {
        Button {
            preferServerAI.toggle()
        } label: {
            HStack(spacing: 4) {
                Image(systemName: preferServerAI ? "cloud.fill" : "iphone")
                    .font(.system(size: 11, weight: .semibold))
                Text(preferServerAI ? "Server AI" : "iPad")
                    .font(.system(size: 11, weight: .semibold))
            }
            .padding(.horizontal, 10)
            .padding(.vertical, 6)
            .background(.ultraThinMaterial, in: Capsule())
            .foregroundStyle(.primary)
        }
        .buttonStyle(.plain)
        .padding(8)
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

/// Two-up A/B compare hero. Pro photographers shoot through near-identical
/// poses and need to pick between them; staring at filmstrip thumbnails
/// at 156×104 px doesn't cut it. This view shows two assets side-by-side
/// at hero-stage scale with synced zoom + pan — magnify one corner of A
/// and the same corner of B follows so the eye can compare detail
/// (sharpness on the catchlight, expression at the mouth) directly.
///
/// Interaction model:
///   - Long-press a filmstrip tile → set as A (anchor, orange ring + "A").
///   - Tap any other tile → become B (focused candidate).
///   - Pinch on either pane → both zoom together; drag → both pan.
///   - Swap button (centre) → promote candidate to anchor + vice-versa.
///   - X button (top-right) → exit, return to single-hero stage.
///
/// Recipe / rating / tune controls intentionally hidden — compare mode
/// is for *picking*, not editing. Once the photographer picks, they
/// exit to the single hero and rate/flag/tune from there.
private struct CompareHeroStage: View {
    let anchor: Asset
    let candidate: Asset
    let onExit: () -> Void
    let onSwap: () -> Void

    @State private var scale: CGFloat = 1
    @State private var lastScale: CGFloat = 1
    @State private var offset: CGSize = .zero
    @State private var lastOffset: CGSize = .zero

    var body: some View {
        VStack(spacing: 12) {
            HStack(spacing: 12) {
                pane(asset: anchor, label: "A", labelColor: .orange)
                pane(asset: candidate, label: "B", labelColor: .accentColor)
            }
            .padding(.horizontal, 24)
            .padding(.top, 16)
            .frame(maxHeight: .infinity)
            .gesture(
                MagnificationGesture()
                    .onChanged { value in
                        scale = max(1, lastScale * value)
                    }
                    .onEnded { _ in
                        lastScale = scale
                        if scale < 1.05 {
                            withAnimation(.spring) {
                                scale = 1
                                lastScale = 1
                                offset = .zero
                                lastOffset = .zero
                            }
                        }
                    }
                    .simultaneously(with:
                        DragGesture()
                            .onChanged { value in
                                guard scale > 1 else { return }
                                offset = CGSize(
                                    width: lastOffset.width + value.translation.width,
                                    height: lastOffset.height + value.translation.height,
                                )
                            }
                            .onEnded { _ in
                                lastOffset = offset
                                if scale <= 1 {
                                    withAnimation(.spring) {
                                        offset = .zero
                                        lastOffset = .zero
                                    }
                                }
                            }
                    )
            )

            HStack(spacing: 14) {
                Text(anchor.originalFilename)
                    .font(.caption.monospaced())
                    .foregroundStyle(.orange)
                    .lineLimit(1)
                    .truncationMode(.middle)
                    .frame(maxWidth: .infinity)

                Button(action: onSwap) {
                    Label("Swap", systemImage: "arrow.left.arrow.right")
                        .font(.callout.weight(.semibold))
                        .padding(.horizontal, 14)
                        .padding(.vertical, 8)
                        .background(.white.opacity(0.08), in: Capsule())
                }
                .buttonStyle(.plain)
                .accessibilityLabel("Swap A and B")

                Text(candidate.originalFilename)
                    .font(.caption.monospaced())
                    .foregroundStyle(Color.accentColor)
                    .lineLimit(1)
                    .truncationMode(.middle)
                    .frame(maxWidth: .infinity)
            }
            .padding(.horizontal, 24)
            .padding(.bottom, 12)

            if scale > 1 {
                Text("Pinch to zoom • drag to pan • both panes synced")
                    .font(.caption2)
                    .foregroundStyle(.secondary)
                    .padding(.bottom, 8)
            }
        }
        .overlay(alignment: .topTrailing) {
            Button(action: onExit) {
                Image(systemName: "xmark.circle.fill")
                    .font(.title2)
                    .symbolRenderingMode(.hierarchical)
                    .foregroundStyle(.white, .white.opacity(0.25))
            }
            .buttonStyle(.plain)
            .padding(.top, 24)
            .padding(.trailing, 36)
            .accessibilityLabel("Exit compare mode")
        }
    }

    @ViewBuilder
    private func pane(asset: Asset, label: String, labelColor: Color) -> some View {
        ZStack {
            RoundedRectangle(cornerRadius: 14)
                .fill(Color.captureChipBG)
            if let key = asset.displayPreviewKey, let image = UIImage(contentsOfFile: key) {
                Image(uiImage: image)
                    .resizable()
                    .aspectRatio(contentMode: .fit)
                    .scaleEffect(scale)
                    .offset(offset)
                    .clipShape(RoundedRectangle(cornerRadius: 14))
                    .shadow(radius: 16, y: 6)
            } else {
                Image(systemName: "photo")
                    .font(.system(size: 48))
                    .foregroundStyle(.tertiary)
            }
        }
        .overlay(alignment: .topLeading) {
            Text(label)
                .font(.title3.weight(.heavy))
                .foregroundStyle(.white)
                .frame(width: 32, height: 32)
                .background(labelColor, in: Circle())
                .padding(12)
        }
        .frame(maxWidth: .infinity)
        .clipped()
    }
}

/// Light-weight review-inbox sheet — chronological glance at recent
/// hearts + comments, designed for *triage*. Shows last ~50 entries,
/// tapping a row dismisses the sheet, focuses that asset, and (if
/// "Open side-by-side" was tapped first) enters review-mode.
///
/// Read-state: opening the sheet flags entries as read on dismiss.
/// Per-tile filmstrip badges remain so the photographer can spot
/// reviewed shots at a glance later.
private struct ReviewInboxSheet: View {
    let reviews: [ClientReview]
    let onSelectReview: (ClientReview) -> Void
    let onOpenSideBySide: () -> Void
    let onDismiss: () -> Void

    var body: some View {
        NavigationStack {
            Group {
                if reviews.isEmpty {
                    ContentUnavailableView(
                        "Ingen tilbakemeldinger ennå",
                        systemImage: "bubble.left.and.bubble.right",
                        description: Text("Når kunden hjerter eller kommenterer på leverte bilder, lander de her."),
                    )
                } else {
                    List {
                        ForEach(reviews) { review in
                            Button {
                                onSelectReview(review)
                            } label: {
                                ReviewInboxRow(review: review)
                            }
                            .buttonStyle(.plain)
                        }
                    }
                    .listStyle(.plain)
                }
            }
            .navigationTitle("Klient-tilbakemeldinger")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarLeading) {
                    Button("Lukk") { onDismiss() }
                }
                ToolbarItem(placement: .topBarTrailing) {
                    Button {
                        onOpenSideBySide()
                    } label: {
                        Label("Side-by-side", systemImage: "rectangle.split.2x1")
                    }
                    .disabled(reviews.isEmpty)
                }
            }
        }
    }
}

private struct ReviewInboxRow: View {
    let review: ClientReview

    var body: some View {
        HStack(alignment: .top, spacing: 12) {
            ZStack {
                Circle()
                    .fill(badgeColor.opacity(0.18))
                    .frame(width: 32, height: 32)
                Image(systemName: badgeIcon)
                    .font(.callout.weight(.semibold))
                    .foregroundStyle(badgeColor)
            }
            VStack(alignment: .leading, spacing: 2) {
                HStack(spacing: 6) {
                    Text(review.displayName ?? (review.senderKind == .photographer ? "Du" : "Klient"))
                        .font(.subheadline.weight(.semibold))
                    Text(review.assetFilename)
                        .font(.caption.monospaced())
                        .foregroundStyle(.secondary)
                    Spacer()
                    Text(review.timestamp, style: .relative)
                        .font(.caption2)
                        .foregroundStyle(.secondary)
                    if review.unread {
                        Circle()
                            .fill(.orange)
                            .frame(width: 7, height: 7)
                    }
                }
                switch review.kind {
                case .heart(let on):
                    Text(on ? "Hjertet bildet" : "Fjernet hjertet")
                        .font(.callout)
                        .foregroundStyle(on ? .pink : .secondary)
                case .comment(let preview):
                    Text(preview)
                        .font(.callout)
                        .lineLimit(3)
                case .audio(_, let duration):
                    Label(formatDuration(duration), systemImage: "waveform")
                        .font(.callout)
                        .foregroundStyle(.blue)
                }
            }
        }
        .padding(.vertical, 6)
    }

    private var badgeColor: Color {
        switch review.kind {
        case .heart: return .pink
        case .comment: return .orange
        case .audio: return .blue
        }
    }

    private var badgeIcon: String {
        switch review.kind {
        case .heart(let on): return on ? "heart.fill" : "heart.slash"
        case .comment: return "bubble.left.fill"
        case .audio: return "mic.fill"
        }
    }

    private func formatDuration(_ seconds: Double) -> String {
        let s = Int(seconds.rounded())
        return String(format: "Stemme-svar · %d:%02d", s / 60, s % 60)
    }
}

/// Sustained review-mode hero — image left (full quality, retains
/// pinch-zoom + tap-to-fullscreen), conversation side-rail right with
/// chat-bubble layout (client right-aligned + orange-tinted,
/// photographer left-aligned + neutral) and a reply input pinned to
/// the bottom. Pro-photo workflow staple: when the client is actively
/// chatting about a shot, the photographer wants the photo + thread
/// side-by-side AND wants to reply without leaving the surface.
private struct ReviewModeStage: View {
    let asset: Asset
    let reviewsForAsset: [ClientReview]
    let allReviews: [ClientReview]
    let replyMemosDirectory: URL
    let onSelectAnotherAsset: (UUID) -> Void
    let onExit: () -> Void
    let onOpenFullscreen: (Asset) -> Void
    let onSendReply: (String) -> Void
    let onSendVoiceReply: (URL, Double) -> Void

    var body: some View {
        HStack(spacing: 16) {
            VStack(spacing: 0) {
                HeroImage(asset: asset, preferMagic: true)
                    .onTapGesture { onOpenFullscreen(asset) }
                    .padding(16)
                Spacer(minLength: 0)
            }

            ReviewSideRail(
                asset: asset,
                reviewsForAsset: reviewsForAsset,
                allReviews: allReviews,
                replyMemosDirectory: replyMemosDirectory,
                onSelectAnotherAsset: onSelectAnotherAsset,
                onExit: onExit,
                onSendReply: onSendReply,
                onSendVoiceReply: onSendVoiceReply,
            )
            .frame(width: 380)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    }
}

private struct ReviewSideRail: View {
    let asset: Asset
    let reviewsForAsset: [ClientReview]
    let allReviews: [ClientReview]
    let replyMemosDirectory: URL
    let onSelectAnotherAsset: (UUID) -> Void
    let onExit: () -> Void
    let onSendReply: (String) -> Void
    let onSendVoiceReply: (URL, Double) -> Void

    @State private var draftReply: String = ""
    @FocusState private var replyFieldFocused: Bool

    private var assetIdsWithReviews: [UUID] {
        var seen: Set<UUID> = []
        var ordered: [UUID] = []
        for review in allReviews where !seen.contains(review.assetId) {
            seen.insert(review.assetId)
            ordered.append(review.assetId)
        }
        return ordered
    }

    /// Latest review per asset, indexed for the bottom switcher's
    /// preview chips. Newest review wins (recentClientReviews is
    /// already sorted newest-first).
    private var latestPerAsset: [UUID: ClientReview] {
        var map: [UUID: ClientReview] = [:]
        for review in allReviews where map[review.assetId] == nil {
            map[review.assetId] = review
        }
        return map
    }

    var body: some View {
        VStack(spacing: 0) {
            // Header — asset thumbnail + filename give the photographer
            // an immediate visual anchor for which shot the thread is
            // discussing. Smaller than the hero on the left but still
            // big enough to recognise without squinting.
            HStack(spacing: 12) {
                if let key = asset.displayPreviewKey, let img = UIImage(contentsOfFile: key) {
                    Image(uiImage: img)
                        .resizable()
                        .aspectRatio(contentMode: .fill)
                        .frame(width: 44, height: 44)
                        .clipShape(RoundedRectangle(cornerRadius: 8))
                } else {
                    RoundedRectangle(cornerRadius: 8)
                        .fill(Color.captureChipBG)
                        .frame(width: 44, height: 44)
                        .overlay {
                            Image(systemName: "photo")
                                .foregroundStyle(.tertiary)
                        }
                }
                VStack(alignment: .leading, spacing: 2) {
                    Text("Tilbakemeldinger")
                        .font(.headline)
                    Text(asset.originalFilename)
                        .font(.caption.monospaced())
                        .foregroundStyle(.secondary)
                }
                Spacer()
                Button(action: onExit) {
                    Image(systemName: "xmark.circle.fill")
                        .font(.title2)
                        .symbolRenderingMode(.hierarchical)
                        .foregroundStyle(.secondary, .secondary.opacity(0.3))
                }
                .buttonStyle(.plain)
                .accessibilityLabel("Lukk review-mode")
            }
            .padding(.horizontal, 16)
            .padding(.vertical, 12)

            Divider()

            // Conversation thread.
            ScrollViewReader { proxy in
                ScrollView {
                    LazyVStack(alignment: .leading, spacing: 8) {
                        if reviewsForAsset.isEmpty {
                            VStack(spacing: 10) {
                                Image(systemName: "bubble.left.and.bubble.right")
                                    .font(.system(size: 36, weight: .light))
                                    .foregroundStyle(.tertiary)
                                Text("Start en samtale")
                                    .font(.callout.weight(.medium))
                                    .foregroundStyle(.secondary)
                                Text("Skriv en kommentar nedenfor — kunden ser den med en gang i galleriet.")
                                    .font(.caption)
                                    .foregroundStyle(.tertiary)
                                    .multilineTextAlignment(.center)
                                    .fixedSize(horizontal: false, vertical: true)
                            }
                            .frame(maxWidth: .infinity)
                            .padding(.horizontal, 24)
                            .padding(.vertical, 32)
                        } else {
                            ForEach(reviewsForAsset.reversed()) { review in
                                ReviewBubble(review: review)
                                    .id(review.id)
                            }
                        }
                    }
                    .padding(.horizontal, 14)
                    .padding(.vertical, 14)
                }
                .onChange(of: reviewsForAsset.count) { _, _ in
                    if let lastId = reviewsForAsset.reversed().last?.id {
                        withAnimation(.easeOut(duration: 0.25)) {
                            proxy.scrollTo(lastId, anchor: .bottom)
                        }
                    }
                }
            }

            Divider()

            // Other assets that have feedback — quick switcher.
            // Bigger touch target than the v1 chips so the photographer
            // can switch threads with a thumb without zooming in.
            if assetIdsWithReviews.count > 1 {
                VStack(alignment: .leading, spacing: 6) {
                    Text("Andre bilder med tilbakemelding")
                        .font(.caption.weight(.semibold))
                        .foregroundStyle(.secondary)
                        .padding(.horizontal, 16)
                    ScrollView(.horizontal, showsIndicators: false) {
                        HStack(spacing: 8) {
                            ForEach(assetIdsWithReviews, id: \.self) { id in
                                ReviewSwitcherChip(
                                    latestReview: latestPerAsset[id],
                                    isFocused: id == asset.id,
                                    onSelect: { onSelectAnotherAsset(id) },
                                )
                            }
                        }
                        .padding(.horizontal, 16)
                    }
                }
                .padding(.vertical, 10)
                Divider()
            }

            // Reply input — pinned to the bottom so the photographer's
            // thumb has a stable target. Send button enables on
            // non-whitespace text. Multi-line capable; max 4 lines
            // before scrolling so the rail doesn't crowd the thread.
            // Voice-memo button (hold-to-record) sits between the
            // text field and send so the photographer can choose
            // their input modality at the moment of replying.
            HStack(alignment: .bottom, spacing: 8) {
                TextField("Skriv et svar…", text: $draftReply, axis: .vertical)
                    .lineLimit(1...4)
                    .textFieldStyle(.plain)
                    .padding(.horizontal, 12)
                    .padding(.vertical, 10)
                    .background(.regularMaterial, in: RoundedRectangle(cornerRadius: 18))
                    .focused($replyFieldFocused)
                    .submitLabel(.send)
                    .onSubmit { commit() }
                AudioRecorderButton(
                    outputDirectory: replyMemosDirectory,
                    onCommit: { url, duration in
                        onSendVoiceReply(url, duration)
                    }
                )
                Button(action: commit) {
                    Image(systemName: "arrow.up.circle.fill")
                        .font(.title2)
                        .foregroundStyle(canSend ? Color.accentColor : .secondary.opacity(0.45))
                }
                .buttonStyle(.plain)
                .disabled(!canSend)
                .accessibilityLabel("Send svar")
            }
            .padding(.horizontal, 14)
            .padding(.vertical, 10)
        }
        .background(.regularMaterial)
        .clipShape(RoundedRectangle(cornerRadius: 16))
        .padding(.vertical, 16)
        .padding(.trailing, 16)
    }

    private var canSend: Bool {
        !draftReply.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
    }

    private func commit() {
        let trimmed = draftReply.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty else { return }
        onSendReply(trimmed)
        draftReply = ""
    }
}

/// Single chat bubble — alignment + tint key off `senderKind`. Hearts
/// from the client render as compact inline-style ("❤️ Holy Crust
/// hjertet · 2m") rather than full bubbles so they don't drown out
/// substantive comments. Photographer hearts intentionally not
/// supported (this is the photographer-side surface — heart-back
/// would be a separate feature).
private struct ReviewBubble: View {
    let review: ClientReview

    var body: some View {
        switch review.kind {
        case .heart(let on):
            HStack(spacing: 6) {
                if !isPhotographer { Spacer(minLength: 0) }
                HStack(spacing: 5) {
                    Image(systemName: on ? "heart.fill" : "heart.slash")
                        .font(.caption.weight(.semibold))
                        .foregroundStyle(.pink)
                    Text("\(senderName) \(on ? "hjertet" : "fjernet hjertet")")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                    Text("·")
                        .font(.caption)
                        .foregroundStyle(.tertiary)
                    Text(review.timestamp, style: .relative)
                        .font(.caption2)
                        .foregroundStyle(.tertiary)
                }
                .padding(.horizontal, 12)
                .padding(.vertical, 6)
                .background(.pink.opacity(0.10), in: Capsule())
                if isPhotographer { Spacer(minLength: 0) }
            }

        case .comment(let preview):
            HStack(alignment: .bottom, spacing: 8) {
                if !isPhotographer { Spacer(minLength: 32) }
                VStack(alignment: isPhotographer ? .leading : .trailing, spacing: 4) {
                    Text(senderName)
                        .font(.caption2.weight(.semibold))
                        .foregroundStyle(.secondary)
                        .padding(.horizontal, 4)
                    Text(preview)
                        .font(.callout)
                        .foregroundStyle(.primary)
                        .padding(.horizontal, 12)
                        .padding(.vertical, 8)
                        .background(
                            (isPhotographer ? Color.secondary : Color.orange).opacity(0.18),
                            in: RoundedRectangle(cornerRadius: 16, style: .continuous)
                        )
                        .overlay(
                            RoundedRectangle(cornerRadius: 16, style: .continuous)
                                .stroke(
                                    (isPhotographer ? Color.secondary : Color.orange).opacity(0.35),
                                    lineWidth: 0.5
                                )
                        )
                    Text(review.timestamp, style: .relative)
                        .font(.caption2)
                        .foregroundStyle(.tertiary)
                        .padding(.horizontal, 4)
                }
                if isPhotographer { Spacer(minLength: 32) }
            }

        case .audio(let path, let duration):
            HStack(alignment: .bottom, spacing: 8) {
                if !isPhotographer { Spacer(minLength: 32) }
                VStack(alignment: isPhotographer ? .leading : .trailing, spacing: 4) {
                    Text(senderName)
                        .font(.caption2.weight(.semibold))
                        .foregroundStyle(.secondary)
                        .padding(.horizontal, 4)
                    AudioPlaybackBubble(
                        path: path,
                        durationSeconds: duration,
                        isPhotographer: isPhotographer,
                    )
                    Text(review.timestamp, style: .relative)
                        .font(.caption2)
                        .foregroundStyle(.tertiary)
                        .padding(.horizontal, 4)
                }
                if isPhotographer { Spacer(minLength: 32) }
            }
        }
    }

    private var isPhotographer: Bool {
        review.senderKind == .photographer
    }

    private var senderName: String {
        review.displayName ?? (isPhotographer ? "Du" : "Klient")
    }
}

/// Pill-shaped audio playback control inside a chat bubble. Owns its
/// own `AVAudioPlayer` lifecycle: tap to start, tap-while-playing to
/// pause, tap-while-paused to resume. Auto-resets to play state when
/// the underlying player hits end-of-file. Visual: progress bar
/// behind the duration label so the photographer / client gets a
/// glance-able sense of how far through the message they are.
private struct AudioPlaybackBubble: View {
    let path: String
    let durationSeconds: Double
    let isPhotographer: Bool

    @State private var player: AVAudioPlayer?
    @State private var isPlaying: Bool = false
    @State private var elapsed: Double = 0
    @State private var progressTimer: Timer?

    private var tint: Color { isPhotographer ? .secondary : .orange }

    var body: some View {
        Button(action: toggle) {
            HStack(spacing: 8) {
                Image(systemName: isPlaying ? "pause.fill" : "play.fill")
                    .font(.callout.weight(.semibold))
                    .foregroundStyle(tint)
                    .frame(width: 16)
                ProgressView(value: progressValue)
                    .progressViewStyle(.linear)
                    .frame(width: 100)
                    .tint(tint)
                Text(formatTime(displayTime))
                    .font(.caption.monospacedDigit())
                    .foregroundStyle(.secondary)
            }
            .padding(.horizontal, 12)
            .padding(.vertical, 8)
            .background(
                tint.opacity(0.18),
                in: RoundedRectangle(cornerRadius: 16, style: .continuous)
            )
            .overlay(
                RoundedRectangle(cornerRadius: 16, style: .continuous)
                    .stroke(tint.opacity(0.35), lineWidth: 0.5)
            )
        }
        .buttonStyle(.plain)
        .onDisappear { stop() }
    }

    private var displayTime: Double {
        if isPlaying { return elapsed }
        return durationSeconds
    }

    private var progressValue: Double {
        guard durationSeconds > 0 else { return 0 }
        return min(1, elapsed / durationSeconds)
    }

    private func toggle() {
        if isPlaying {
            player?.pause()
            isPlaying = false
            stopTimer()
            return
        }
        if player == nil {
            do {
                try AVAudioSession.sharedInstance().setCategory(.playback, mode: .default)
                try AVAudioSession.sharedInstance().setActive(true)
                let p = try AVAudioPlayer(contentsOf: URL(fileURLWithPath: path))
                p.prepareToPlay()
                player = p
            } catch {
                return
            }
        }
        guard let player else { return }
        if player.play() {
            isPlaying = true
            startTimer()
        }
    }

    private func startTimer() {
        stopTimer()
        progressTimer = Timer.scheduledTimer(withTimeInterval: 0.1, repeats: true) { _ in
            Task { @MainActor in
                guard let player else { return }
                elapsed = player.currentTime
                if !player.isPlaying {
                    isPlaying = false
                    elapsed = 0
                    stopTimer()
                }
            }
        }
    }

    private func stopTimer() {
        progressTimer?.invalidate()
        progressTimer = nil
    }

    private func stop() {
        player?.stop()
        player = nil
        isPlaying = false
        elapsed = 0
        stopTimer()
    }

    private func formatTime(_ seconds: Double) -> String {
        let s = Int(seconds.rounded())
        return String(format: "%d:%02d", s / 60, s % 60)
    }
}

/// Hold-to-record voice-memo button for ReviewSideRail. Owns its own
/// `AVAudioRecorder` lifecycle: press-and-hold starts recording (1-15s
/// cap; pulsing red dot + elapsed counter while held), release commits
/// + invokes the closure with (URL, duration). Cancels gracefully if
/// the user drags off-button mid-record. AAC m4a at 44.1kHz mono medium
/// quality — small file size + clear voice is the priority over
/// audiophile fidelity.
private struct AudioRecorderButton: View {
    let outputDirectory: URL
    let onCommit: (URL, Double) -> Void

    @State private var recorder: AVAudioRecorder?
    @State private var isRecording: Bool = false
    @State private var startedAt: Date?
    @State private var pulseOn: Bool = false
    @State private var displayElapsed: Double = 0
    @State private var pulseTimer: Timer?
    @State private var permissionDenied: Bool = false

    /// Hard cap matches `VoiceMemoService.maxRecordingDuration` (60s)
    /// for chat replies — short voice notes vs. long-form per-asset
    /// memos. UI limits to 15s for terseness.
    static let maxDuration: TimeInterval = 15

    var body: some View {
        ZStack {
            Image(systemName: isRecording ? "stop.circle.fill" : "mic.circle.fill")
                .font(.title2)
                .foregroundStyle(isRecording ? Color.red : Color.accentColor)
                .scaleEffect(pulseOn ? 1.1 : 1.0)
                .animation(
                    .easeInOut(duration: 0.5).repeatForever(autoreverses: true),
                    value: pulseOn,
                )
            if isRecording {
                Text(formatElapsed(displayElapsed))
                    .font(.caption2.monospacedDigit().weight(.semibold))
                    .foregroundStyle(.white)
                    .padding(.horizontal, 6)
                    .padding(.vertical, 2)
                    .background(.red, in: Capsule())
                    .offset(x: 28, y: 0)
            }
        }
        .frame(width: 36, height: 36)
        .contentShape(Rectangle())
        .gesture(
            LongPressGesture(minimumDuration: 0.2)
                .onEnded { _ in startRecording() }
                .sequenced(before: DragGesture(minimumDistance: 0))
                .onEnded { _ in finishRecording() }
        )
        .alert("Mikrofon-tilgang", isPresented: $permissionDenied) {
            Button("OK", role: .cancel) {}
        } message: {
            Text("Slå på mikrofon-tilgang i Innstillinger for å spille inn lyd-svar.")
        }
        .accessibilityLabel("Hold for å spille inn lyd-svar")
    }

    private func startRecording() {
        guard !isRecording else { return }
        AVAudioSession.sharedInstance().requestRecordPermission { granted in
            Task { @MainActor in
                guard granted else { permissionDenied = true; return }
                beginRecorder()
            }
        }
    }

    private func beginRecorder() {
        try? FileManager.default.createDirectory(
            at: outputDirectory, withIntermediateDirectories: true,
        )
        let url = outputDirectory.appendingPathComponent("\(UUID().uuidString).m4a")
        let settings: [String: Any] = [
            AVFormatIDKey: Int(kAudioFormatMPEG4AAC),
            AVSampleRateKey: 44_100,
            AVNumberOfChannelsKey: 1,
            AVEncoderAudioQualityKey: AVAudioQuality.medium.rawValue,
        ]
        do {
            try AVAudioSession.sharedInstance().setCategory(
                .playAndRecord, mode: .default, options: [.defaultToSpeaker],
            )
            try AVAudioSession.sharedInstance().setActive(true)
            let r = try AVAudioRecorder(url: url, settings: settings)
            r.record(forDuration: Self.maxDuration)
            recorder = r
            isRecording = true
            startedAt = Date()
            pulseOn = true
            startElapsedTimer()
        } catch {
            isRecording = false
            recorder = nil
        }
    }

    private func startElapsedTimer() {
        pulseTimer?.invalidate()
        pulseTimer = Timer.scheduledTimer(withTimeInterval: 0.1, repeats: true) { _ in
            Task { @MainActor in
                guard let started = startedAt else { return }
                displayElapsed = Date().timeIntervalSince(started)
                if displayElapsed >= Self.maxDuration {
                    finishRecording()
                }
            }
        }
    }

    private func finishRecording() {
        guard isRecording, let recorder, let started = startedAt else {
            cleanupTimer()
            return
        }
        let url = recorder.url
        let duration = Date().timeIntervalSince(started)
        recorder.stop()
        self.recorder = nil
        isRecording = false
        pulseOn = false
        startedAt = nil
        cleanupTimer()
        // Discard < 0.5 s recordings (accidental tap, not intent).
        guard duration >= 0.5,
              FileManager.default.fileExists(atPath: url.path) else {
            try? FileManager.default.removeItem(at: url)
            return
        }
        onCommit(url, duration)
    }

    private func cleanupTimer() {
        pulseTimer?.invalidate()
        pulseTimer = nil
        displayElapsed = 0
    }

    private func formatElapsed(_ seconds: Double) -> String {
        let total = Int(seconds.rounded())
        return String(format: "%d:%02d", total / 60, total % 60)
    }
}

private struct ReviewSwitcherChip: View {
    let latestReview: ClientReview?
    let isFocused: Bool
    let onSelect: () -> Void

    var body: some View {
        Button(action: onSelect) {
            HStack(spacing: 8) {
                if let latest = latestReview {
                    Image(systemName: chipIcon(for: latest))
                        .font(.caption2.weight(.semibold))
                        .foregroundStyle(chipTint(for: latest))
                }
                VStack(alignment: .leading, spacing: 1) {
                    Text(latestReview?.assetFilename ?? "—")
                        .font(.caption.monospaced())
                        .lineLimit(1)
                        .truncationMode(.middle)
                    if let preview = latestReview.flatMap(commentPreview) {
                        Text(preview)
                            .font(.caption2)
                            .foregroundStyle(.secondary)
                            .lineLimit(1)
                            .truncationMode(.tail)
                    }
                }
            }
            .padding(.horizontal, 12)
            .padding(.vertical, 8)
            .background(
                isFocused ? Color.accentColor.opacity(0.18) : Color.white.opacity(0.06),
                in: RoundedRectangle(cornerRadius: 10)
            )
            .overlay(
                RoundedRectangle(cornerRadius: 10).stroke(
                    isFocused ? Color.accentColor.opacity(0.6) : Color.clear,
                    lineWidth: 1
                )
            )
        }
        .buttonStyle(.plain)
    }

    private func chipIcon(for review: ClientReview) -> String {
        switch review.kind {
        case .heart(let on): return on ? "heart.fill" : "heart.slash"
        case .comment: return "bubble.left.fill"
        case .audio: return "waveform"
        }
    }

    private func chipTint(for review: ClientReview) -> Color {
        switch review.kind {
        case .heart: return .pink
        case .comment: return .orange
        case .audio: return .blue
        }
    }

    private func commentPreview(_ review: ClientReview) -> String? {
        if case .comment(let p) = review.kind {
            return p
        }
        return nil
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
    /// Nudging this forces re-reading the JPEG from disk after MagicPipeline
    /// overwrites it at the same path.
    @State private var reloadToken: Int = 0

    var body: some View {
        GeometryReader { geo in
            ZStack(alignment: .topLeading) {
                // Base: enhanced image (shown as the "result" side)
                ImageFile(path: enhancedPath, reload: reloadToken)
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
                    .clipped()

                // Overlay: original, clipped to LEFT portion via mask
                ImageFile(path: originalPath, reload: reloadToken)
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
    /// Bump to force a re-read of the file (same path, new bytes).
    var reload: Int = 0
    var body: some View {
        Group {
            if let img = UIImage(contentsOfFile: path) {
                Image(uiImage: img).resizable().aspectRatio(contentMode: .fit)
            } else {
                Color.captureChipBG
            }
        }
        .id("\(path)#\(reload)")
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

/// Voice memo recorder + playback control for the focused asset.
///
/// States:
///   - No memo, idle → mic button (tap to start recording)
///   - Recording this asset → red pulsing stop button
///   - Memo exists, idle → play button + small dot indicator
///   - Memo exists, playing → stop-playback button
///
/// Long-press on a play button = delete memo. Long-press is intentional
/// (matches the dangerous-action convention used by the reject button)
/// so a stray tap during shutter doesn't wipe a recorded note.
private struct VoiceMemoControls: View {
    let assetId: UUID
    let state: VoiceMemoService.State
    let memoExists: Bool
    let onStart: () -> Void
    let onStop: () -> Void
    let onPlay: () -> Void
    let onDelete: () -> Void

    var body: some View {
        HStack(spacing: 6) {
            switch resolvedMode {
            case .recordIdle:
                button(icon: "mic", tint: .white.opacity(0.45), background: .clear, action: onStart)
                    .accessibilityLabel("Record voice memo")

            case .recording:
                button(icon: "stop.fill", tint: .white, background: Color.red.opacity(0.85), action: onStop)
                    .accessibilityLabel("Stop recording")
                    .overlay(alignment: .topTrailing) {
                        Circle()
                            .fill(.red)
                            .frame(width: 8, height: 8)
                            .opacity(pulseOn ? 1 : 0.25)
                            .animation(
                                .easeInOut(duration: 0.7).repeatForever(autoreverses: true),
                                value: pulseOn
                            )
                            .padding(2)
                    }
                    .onAppear { pulseOn = true }
                    .onDisappear { pulseOn = false }

            case .playable:
                button(icon: "play.fill", tint: .white, background: Color.blue.opacity(0.55), action: onPlay)
                    .accessibilityLabel("Play voice memo")
                    .onLongPressGesture(minimumDuration: 0.6) { onDelete() }

            case .playing:
                button(icon: "stop.fill", tint: .white, background: Color.blue.opacity(0.55), action: onPlay)
                    .accessibilityLabel("Stop voice memo playback")
                    .onLongPressGesture(minimumDuration: 0.6) { onDelete() }
            }
        }
    }

    @State private var pulseOn = false

    private enum Mode { case recordIdle, recording, playable, playing }

    private var resolvedMode: Mode {
        switch state {
        case .recording(let id, _) where id == assetId: return .recording
        case .playing(let id) where id == assetId:      return .playing
        default:
            return memoExists ? .playable : .recordIdle
        }
    }

    private func button(icon: String, tint: Color, background: Color, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            Image(systemName: icon)
                .font(.title3)
                .foregroundStyle(tint)
                .frame(width: 36, height: 36)
                .background(background, in: Circle())
        }
        .buttonStyle(.plain)
    }
}

/// Lightroom-style 8-color label row. Tapping the active color clears.
/// Visual: small filled circles with a thicker ring on the current label.
/// Numeric keyboard shortcuts (6–9) intentionally avoided — they collide
/// with rating keys (1–5); colors are mouse/touch-driven.
private struct ColorLabelControls: View {
    let current: ColorLabel?
    let onSet: (ColorLabel?) -> Void

    var body: some View {
        HStack(spacing: 6) {
            ForEach(ColorLabel.allCases, id: \.self) { label in
                Button {
                    onSet(current == label ? nil : label)
                } label: {
                    Circle()
                        .fill(Color.from(colorLabel: label))
                        .frame(width: 18, height: 18)
                        .overlay {
                            Circle()
                                .stroke(
                                    current == label ? Color.white : Color.white.opacity(0.2),
                                    lineWidth: current == label ? 2.5 : 1
                                )
                        }
                        .scaleEffect(current == label ? 1.15 : 1.0)
                        .animation(.spring(duration: 0.2), value: current)
                }
                .buttonStyle(.plain)
                .accessibilityLabel("Set color label: \(label.rawValue)")
            }
        }
    }
}

// MARK: - HUD overlays (histogram + clipping + skin tone)

/// On-set coaching surface — pro tether software shows these so the
/// photographer can spot clipped highlights, off-white-balance faces,
/// or underexposed shadows without leaving the shooting screen.
private struct HUDOverlay: View {
    let analysis: ImageAnalysis

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            HistogramChart(red: analysis.red, green: analysis.green, blue: analysis.blue)
                .frame(width: 160, height: 70)
                .padding(8)
                .background(.black.opacity(0.55), in: RoundedRectangle(cornerRadius: 8))
                .overlay(RoundedRectangle(cornerRadius: 8).stroke(.white.opacity(0.1), lineWidth: 0.5))

            if analysis.highlightClipping > 0.005 || analysis.shadowClipping > 0.005 {
                ClippingBadges(highlight: analysis.highlightClipping, shadow: analysis.shadowClipping)
            }

            if let skin = analysis.skin {
                SkinToneChip(reading: skin)
            }
        }
    }
}

private struct HistogramChart: View {
    let red: [Double]
    let green: [Double]
    let blue: [Double]

    var body: some View {
        Canvas { context, size in
            guard !red.isEmpty else { return }
            let binWidth = size.width / CGFloat(red.count)
            draw(context, channel: red, color: .red, size: size, binWidth: binWidth)
            draw(context, channel: green, color: .green, size: size, binWidth: binWidth)
            draw(context, channel: blue, color: .blue, size: size, binWidth: binWidth)
        }
    }

    private func draw(_ ctx: GraphicsContext, channel: [Double], color: Color, size: CGSize, binWidth: CGFloat) {
        var path = Path()
        path.move(to: CGPoint(x: 0, y: size.height))
        for (i, value) in channel.enumerated() {
            let x = CGFloat(i) * binWidth + binWidth / 2
            let y = size.height - CGFloat(value) * size.height
            path.addLine(to: CGPoint(x: x, y: y))
        }
        path.addLine(to: CGPoint(x: size.width, y: size.height))
        path.closeSubpath()
        ctx.fill(path, with: .color(color.opacity(0.45)))
        ctx.stroke(path, with: .color(color.opacity(0.9)), lineWidth: 1)
    }
}

private struct ClippingBadges: View {
    let highlight: Double
    let shadow: Double

    var body: some View {
        HStack(spacing: 6) {
            if highlight > 0.005 {
                badge(text: "⚠ \(percent(highlight))", color: .red)
            }
            if shadow > 0.005 {
                badge(text: "⚠ \(percent(shadow))", color: .blue)
            }
        }
    }

    private func badge(text: String, color: Color) -> some View {
        Text(text)
            .font(.caption2.weight(.semibold))
            .padding(.horizontal, 8).padding(.vertical, 3)
            .foregroundStyle(.white)
            .background(color.opacity(0.85), in: Capsule())
    }

    private func percent(_ v: Double) -> String {
        let p = Int((v * 100).rounded())
        return p < 1 ? "<1%" : "\(p)%"
    }
}

private struct SkinToneChip: View {
    let reading: ImageAnalysis.SkinReading

    var body: some View {
        HStack(spacing: 8) {
            RoundedRectangle(cornerRadius: 4)
                .fill(Color(cgColor: reading.sampleColor))
                .frame(width: 18, height: 18)
                .overlay(RoundedRectangle(cornerRadius: 4).stroke(.white.opacity(0.3), lineWidth: 0.5))
            VStack(alignment: .leading, spacing: 0) {
                Text("Skin")
                    .font(.caption2.weight(.medium))
                    .foregroundStyle(.white)
                Text(label)
                    .font(.caption2)
                    .foregroundStyle(color.opacity(0.9))
            }
        }
        .padding(.horizontal, 8).padding(.vertical, 5)
        .background(.black.opacity(0.55), in: RoundedRectangle(cornerRadius: 6))
        .overlay(RoundedRectangle(cornerRadius: 6).stroke(color.opacity(0.5), lineWidth: 1))
    }

    private var label: String {
        switch reading.cast {
        case .neutral:    return "neutral ✓"
        case .tooWarm:    return "too warm"
        case .tooCool:    return "too cool"
        case .tooGreen:   return "green cast"
        case .tooMagenta: return "magenta cast"
        }
    }

    private var color: Color {
        switch reading.cast {
        case .neutral:    return .green
        case .tooWarm, .tooMagenta: return .orange
        case .tooCool, .tooGreen:   return .blue
        }
    }
}

// MARK: - Recipe chips + Tune panel

private struct RecipeChipsRow: View {
    let chips: [String]
    let source: LiveCaptureModel.RecipeSource

    var body: some View {
        HStack(spacing: 6) {
            Image(systemName: leadingIcon)
                .font(.caption.weight(.semibold))
                .foregroundStyle(accent)
            if chips.isEmpty {
                Text("At baseline")
                    .font(.caption.monospaced())
                    .padding(.horizontal, 8)
                    .padding(.vertical, 4)
                    .foregroundStyle(.secondary)
                    .background(Color.captureChipBG, in: Capsule())
            } else {
                ForEach(chips, id: \.self) { chip in
                    Text(chip)
                        .font(.caption.monospaced())
                        .padding(.horizontal, 8)
                        .padding(.vertical, 4)
                        .foregroundStyle(.secondary)
                        .background(Color.captureChipBG, in: Capsule())
                }
            }
            Text(trailingLabel)
                .font(.caption.weight(.semibold))
                .padding(.horizontal, 10)
                .padding(.vertical, 4)
                .foregroundStyle(accent)
                .overlay(Capsule().stroke(accent.opacity(0.6), lineWidth: 1))
        }
    }

    private var leadingIcon: String {
        switch source {
        case .baseline:    return "sparkles"
        case .aiRefined:   return "sparkles.rectangle.stack"
        case .userTuned:   return "slider.horizontal.3"
        }
    }

    private var accent: Color {
        switch source {
        case .baseline:    return .purple
        case .aiRefined:   return .cyan
        case .userTuned:   return .orange
        }
    }

    private var trailingLabel: String {
        switch source {
        case .baseline:    return "Tune"
        case .aiRefined:   return "AI · tap to tune"
        case .userTuned:   return "Tuned"
        }
    }
}

/// Quality observations Claude flagged — eyes closed, motion blur, clipped
/// highlights. Dismissable so a single nag doesn't block the hero forever.
/// Tap any pill or the X to clear them all for this asset.
private struct AIQualityNotesRow: View {
    let notes: [String]
    let onDismiss: () -> Void

    var body: some View {
        HStack(alignment: .top, spacing: 8) {
            Image(systemName: "exclamationmark.triangle.fill")
                .font(.caption.weight(.semibold))
                .foregroundStyle(.yellow)
                .padding(.top, 4)
            VStack(alignment: .leading, spacing: 4) {
                ForEach(notes, id: \.self) { note in
                    Text(note)
                        .font(.caption)
                        .foregroundStyle(.primary)
                        .padding(.horizontal, 10)
                        .padding(.vertical, 5)
                        .background(Color.yellow.opacity(0.15), in: Capsule())
                        .overlay(Capsule().stroke(.yellow.opacity(0.5), lineWidth: 0.5))
                }
            }
            Spacer(minLength: 0)
            Button(action: onDismiss) {
                Image(systemName: "xmark.circle.fill")
                    .font(.title3)
                    .foregroundStyle(.secondary)
            }
            .buttonStyle(.plain)
            .accessibilityLabel("Dismiss quality notes")
        }
        .padding(.horizontal, 4)
    }
}

/// AI caption suggestion — small, secondary text under the hero. Tap to
/// copy to clipboard for paste into delivery / metadata workflow.
private struct AICaptionRow: View {
    let caption: String
    @State private var copied: Bool = false

    var body: some View {
        Button {
            UIPasteboard.general.string = caption
            withAnimation { copied = true }
            Task {
                try? await Task.sleep(for: .seconds(1.4))
                withAnimation { copied = false }
            }
        } label: {
            HStack(spacing: 8) {
                Image(systemName: copied ? "checkmark.circle.fill" : "text.quote")
                    .font(.caption.weight(.semibold))
                    .foregroundStyle(copied ? .green : .cyan)
                Text(copied ? "Caption copied" : caption)
                    .font(.caption.italic())
                    .foregroundStyle(.secondary)
                    .lineLimit(2)
                    .multilineTextAlignment(.leading)
                Spacer(minLength: 0)
            }
            .padding(.horizontal, 10)
            .padding(.vertical, 6)
            .background(Color.captureChipBG, in: RoundedRectangle(cornerRadius: 8))
        }
        .buttonStyle(.plain)
    }
}

struct TunePanel: View {
    let initialRecipe: MagicRecipe
    let onChange: (MagicRecipe) -> Void
    let onReset: () -> Void
    let onApplyToScope: ((LiveCaptureModel.RecipeApplyScope) -> Void)?
    let assetCounts: ScopeCounts

    struct ScopeCounts {
        let flagged: Int
        let fourPlus: Int
        let entireSession: Int
    }

    @State private var recipe: MagicRecipe
    @State private var debounce: Task<Void, Never>?
    @State private var pendingApplyScope: LiveCaptureModel.RecipeApplyScope?
    @Environment(\.dismiss) private var dismiss

    init(initialRecipe: MagicRecipe,
         onChange: @escaping (MagicRecipe) -> Void,
         onReset: @escaping () -> Void,
         onApplyToScope: ((LiveCaptureModel.RecipeApplyScope) -> Void)? = nil,
         assetCounts: ScopeCounts = .init(flagged: 0, fourPlus: 0, entireSession: 0)) {
        self.initialRecipe = initialRecipe
        self.onChange = onChange
        self.onReset = onReset
        self.onApplyToScope = onApplyToScope
        self.assetCounts = assetCounts
        self._recipe = State(initialValue: initialRecipe)
    }

    var body: some View {
        NavigationStack {
            scrollContent
                .scrollDismissesKeyboard(.immediately)
                .navigationTitle("Magic · Tune")
                .navigationBarTitleDisplayMode(.inline)
                .toolbar { doneToolbar }
                .onChange(of: recipe, debouncedNotify)
                .alert(
                    alertTitle,
                    isPresented: alertBinding,
                    presenting: pendingApplyScope,
                    actions: alertActions,
                    message: alertMessage,
                )
        }
    }

    private var scrollContent: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 22) {
                PresetChipRow(currentRecipe: recipe) { preset in
                    recipe = preset
                }
                lightSection
                toneSection
                peopleSection
                geometrySection
                if onApplyToScope != nil { applyToScopeSection }
                resetButton
            }
            .padding(20)
        }
    }

    @ToolbarContentBuilder
    private var doneToolbar: some ToolbarContent {
        ToolbarItem(placement: .topBarTrailing) {
            Button("Ferdig") { dismiss() }
                .fontWeight(.semibold)
        }
    }

    private func debouncedNotify(_ old: MagicRecipe, _ new: MagicRecipe) {
        debounce?.cancel()
        debounce = Task {
            try? await Task.sleep(for: .milliseconds(120))
            if !Task.isCancelled { onChange(new) }
        }
    }

    private var alertTitle: String {
        "Bruk recipen på \(pendingApplyScope?.label.lowercased() ?? "")?"
    }

    private var alertBinding: Binding<Bool> {
        Binding(
            get: { pendingApplyScope != nil },
            set: { if !$0 { pendingApplyScope = nil } }
        )
    }

    @ViewBuilder
    private func alertActions(_ scope: LiveCaptureModel.RecipeApplyScope) -> some View {
        Button("Bruk") {
            onApplyToScope?(scope)
            pendingApplyScope = nil
            dismiss()
        }
        Button("Avbryt", role: .cancel) { pendingApplyScope = nil }
    }

    @ViewBuilder
    private func alertMessage(_ scope: LiveCaptureModel.RecipeApplyScope) -> some View {
        let n: Int = {
            switch scope {
            case .allFlagged:    return assetCounts.flagged
            case .allFourPlus:   return assetCounts.fourPlus
            case .entireSession: return assetCounts.entireSession
            }
        }()
        Text("Recipen kopieres til \(n) målbilder. Hver kopi kan finjusteres per bilde senere.")
    }

    private var lightSection: some View {
        section(title: "Lys", subtitle: "Eksponering · skygger · høylys") {
            TuneSlider(
                title: "Warmth", icon: "thermometer.sun",
                value: $recipe.warmth, range: -1...1,
                format: warmthFormat,
            )
            TuneSlider(
                title: "Shadow lift", icon: "circle.lefthalf.filled",
                value: $recipe.shadowLift, range: 0...1,
                format: percentFormat,
            )
            TuneSlider(
                title: "Highlight recovery", icon: "sun.max",
                value: $recipe.highlightRecovery, range: 0...1,
                format: percentFormat,
            )
        }
    }

    private var toneSection: some View {
        section(title: "Tone", subtitle: "Kontrast · metning") {
            TuneSlider(
                title: "Contrast", icon: "rectangle.lefthalf.inset.filled",
                value: $recipe.contrast, range: -1...1,
                format: signedPercent,
            )
            TuneSlider(
                title: "Saturation", icon: "paintpalette",
                value: $recipe.saturation, range: -1...1,
                format: signedPercent,
            )
        }
    }

    private var geometrySection: some View {
        section(title: "Geometri", subtitle: "Auto-rett horisont · manuell vinkel") {
            Toggle(isOn: $recipe.autoStraighten) {
                Label("Auto-rett horisont", systemImage: "level")
            }
            TuneSlider(
                title: "Vinkel", icon: "arrow.triangle.2.circlepath",
                // ±15° → ±0.2618 rad. Slider operates in radians;
                // format converts to degrees for display.
                value: $recipe.straightenAngle, range: -0.2618...0.2618,
                format: degreeFormat,
            )
        }
    }

    private func degreeFormat(_ radians: Double) -> String {
        let deg = radians * 180.0 / .pi
        return String(format: "%+.1f°", deg)
    }

    private var peopleSection: some View {
        section(title: "Personer", subtitle: "Hud · øyne · tenner · subject-type — Evoto-style decomposition") {
            Picker("Subject", selection: $recipe.subjectType) {
                Text("Auto").tag(MagicRecipe.SubjectType.none)
                Text("Mann").tag(MagicRecipe.SubjectType.male)
                Text("Kvinne").tag(MagicRecipe.SubjectType.female)
                Text("Barn").tag(MagicRecipe.SubjectType.child)
                Text("Eldre").tag(MagicRecipe.SubjectType.elderly)
            }
            .pickerStyle(.segmented)
            TuneSlider(
                title: "Skin Tone", icon: "drop.fill",
                value: $recipe.skinLowFreq, range: -1...1,
                format: signedPercent,
            )
            TuneSlider(
                title: "Skin Detail", icon: "circle.grid.cross",
                value: $recipe.skinHighFreq, range: -1...1,
                format: signedPercent,
            )
            TuneSlider(
                title: "Skin Unify", icon: "person.crop.rectangle",
                value: $recipe.skinUnify, range: 0...1,
                format: percentFormat,
            )
            TuneSlider(
                title: "Eye Sharpen", icon: "eye",
                value: $recipe.eyeSharpen, range: 0...1,
                format: percentFormat,
            )
            TuneSlider(
                title: "Catch-light", icon: "sparkle",
                value: $recipe.eyeCatchlight, range: 0...1,
                format: percentFormat,
            )
            TuneSlider(
                title: "Teeth Whiten", icon: "mouth",
                value: $recipe.teethWhiten, range: 0...1,
                format: percentFormat,
            )
        }
    }

    private var applyToScopeSection: some View {
        section(
            title: "Bruk på flere bilder",
            subtitle: "Lightroom-style batch — denne recipen kopieres til hver target",
        ) {
            VStack(spacing: 8) {
                applyButton(.allFlagged,    count: assetCounts.flagged)
                applyButton(.allFourPlus,   count: assetCounts.fourPlus)
                applyButton(.entireSession, count: assetCounts.entireSession)
            }
        }
    }

    private var resetButton: some View {
        Button(role: .destructive) {
            recipe = initialRecipe
            onReset()
        } label: {
            Label("Tilbakestill til baseline", systemImage: "arrow.uturn.backward")
                .frame(maxWidth: .infinity, minHeight: 40)
        }
        .buttonStyle(.bordered)
        .tint(.red)
        .padding(.top, 4)
    }

    private func percentFormat(_ v: Double) -> String {
        "\(Int((v * 100).rounded()))%"
    }

    private func warmthFormat(_ v: Double) -> String {
        let k = Int((v * 900).rounded())
        return k == 0 ? "nøytral" : "\(k > 0 ? "+" : "")\(k)K"
    }

    @ViewBuilder
    private func applyButton(_ scope: LiveCaptureModel.RecipeApplyScope, count: Int) -> some View {
        Button {
            pendingApplyScope = scope
        } label: {
            HStack {
                Label(scope.label, systemImage: scope.icon)
                    .font(.callout.weight(.medium))
                Spacer()
                Text("\(count) bilder")
                    .font(.caption.monospacedDigit())
                    .foregroundStyle(.secondary)
                Image(systemName: "chevron.right")
                    .font(.caption)
                    .foregroundStyle(.tertiary)
            }
            .padding(.horizontal, 14)
            .padding(.vertical, 12)
            .background(.regularMaterial, in: RoundedRectangle(cornerRadius: 12))
        }
        .buttonStyle(.plain)
        .disabled(count == 0)
        .opacity(count == 0 ? 0.5 : 1)
    }

    @ViewBuilder
    private func section<Content: View>(
        title: String,
        subtitle: String,
        @ViewBuilder content: () -> Content,
    ) -> some View {
        VStack(alignment: .leading, spacing: 14) {
            VStack(alignment: .leading, spacing: 2) {
                Text(title)
                    .font(.subheadline.weight(.semibold))
                    .textCase(.uppercase)
                    .foregroundStyle(.secondary)
                Text(subtitle)
                    .font(.caption)
                    .foregroundStyle(.tertiary)
            }
            content()
        }
    }

    private func signedPercent(_ v: Double) -> String {
        let pct = Int((v * 100).rounded())
        return pct == 0 ? "neutral" : "\(pct > 0 ? "+" : "")\(pct)%"
    }
}

/// Phase 5.3 — initial-letter avatars for peer photographers in the
/// same session. First 3 render inline; "+N" overflow chip when more.
/// Avatar color is derived deterministically from userId hash so the
/// same peer renders the same color across reconnects + multi-iPad
/// (lead + assistant always see each other in the same hues).
private struct PresenceAvatarRow: View {
    let peers: [LiveCaptureModel.PresentPeer]

    private var visiblePeers: ArraySlice<LiveCaptureModel.PresentPeer> {
        peers.prefix(3)
    }

    private var overflowCount: Int {
        max(0, peers.count - 3)
    }

    var body: some View {
        HStack(spacing: -6) {
            ForEach(Array(visiblePeers), id: \.id) { peer in
                avatar(for: peer)
                    .help(peer.displayName ?? "Photographer")
            }
            if overflowCount > 0 {
                Text("+\(overflowCount)")
                    .font(.caption2.weight(.semibold).monospacedDigit())
                    .foregroundStyle(.white)
                    .frame(width: 24, height: 24)
                    .background(Color.gray.opacity(0.7), in: Circle())
                    .overlay(Circle().stroke(.background, lineWidth: 1.5))
            }
        }
    }

    private func avatar(for peer: LiveCaptureModel.PresentPeer) -> some View {
        let initial = (peer.displayName?.first.map { String($0).uppercased() }
                       ?? String(peer.id.prefix(1)).uppercased())
        return Text(initial)
            .font(.caption.weight(.semibold))
            .foregroundStyle(.white)
            .frame(width: 24, height: 24)
            .background(Color.peerAvatar(for: peer.id), in: Circle())
            .overlay(Circle().stroke(.background, lineWidth: 1.5))
    }
}

/// Quick-apply preset row at the top of the Tune panel. Each chip
/// swaps the entire recipe, so a photographer who just shot a
/// portrait can flip to "Food" mid-batch when the next subject is a
/// product on a plate. Active state highlights the preset whose
/// slider snapshot matches the current recipe (within tolerance) so
/// the photographer can see "I'm currently in Portrait-territory" at
/// a glance.
private struct PresetChipRow: View {
    let currentRecipe: MagicRecipe
    let onPick: (MagicRecipe) -> Void

    private struct Preset: Identifiable {
        let id: String
        let label: String
        let symbol: String
        let recipe: MagicRecipe
    }

    private let presets: [Preset] = [
        Preset(id: "portrait",  label: "Portrett",  symbol: "person.crop.circle",     recipe: .portrait),
        Preset(id: "food",      label: "Mat",       symbol: "fork.knife",             recipe: .food),
        Preset(id: "landscape", label: "Landskap",  symbol: "mountain.2",             recipe: .landscape),
        Preset(id: "vehicle",   label: "Kjøretøy",  symbol: "car",                    recipe: .vehicle),
        Preset(id: "product",   label: "Produkt",   symbol: "cube.box",               recipe: .product),
        Preset(id: "aviation",  label: "Fly",       symbol: "airplane",               recipe: .aviation),
        Preset(id: "neutral",   label: "Nøytral",   symbol: "circle.dashed",          recipe: .neutral),
    ]

    var body: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: 8) {
                ForEach(presets) { preset in
                    Button {
                        onPick(preset.recipe)
                    } label: {
                        VStack(spacing: 6) {
                            Image(systemName: preset.symbol)
                                .font(.title3)
                            Text(preset.label)
                                .font(.caption.weight(.medium))
                        }
                        .frame(width: 78, height: 64)
                        .background(
                            isActive(preset)
                                ? Color.accentColor.opacity(0.18)
                                : Color.secondary.opacity(0.08),
                            in: RoundedRectangle(cornerRadius: 12)
                        )
                        .overlay(
                            RoundedRectangle(cornerRadius: 12)
                                .stroke(
                                    isActive(preset)
                                        ? Color.accentColor.opacity(0.65)
                                        : Color.clear,
                                    lineWidth: 1.2
                                )
                        )
                        .foregroundStyle(isActive(preset) ? Color.accentColor : .primary)
                    }
                    .buttonStyle(.plain)
                }
            }
            .padding(.horizontal, 2)
        }
    }

    /// Active when every numeric axis lies within ±0.05 of the
    /// preset's snapshot. Tolerance keeps the highlight stable while
    /// the photographer nudges sliders in fine increments — they'd
    /// expect the chip to stay highlighted unless they significantly
    /// drifted from the preset.
    private func isActive(_ preset: Preset) -> Bool {
        let r1 = currentRecipe
        let r2 = preset.recipe
        let tolerance = 0.05
        return abs(r1.warmth - r2.warmth) < tolerance
            && abs(r1.skinHighFreq - r2.skinHighFreq) < tolerance
            && abs(r1.skinLowFreq - r2.skinLowFreq) < tolerance
            && abs(r1.skinSmooth - r2.skinSmooth) < tolerance
            && abs(r1.shadowLift - r2.shadowLift) < tolerance
            && abs(r1.contrast - r2.contrast) < tolerance
            && abs(r1.saturation - r2.saturation) < tolerance
            && abs(r1.highlightRecovery - r2.highlightRecovery) < tolerance
            && abs(r1.eyeSharpen - r2.eyeSharpen) < tolerance
            && abs(r1.eyeCatchlight - r2.eyeCatchlight) < tolerance
            && r1.autoStraighten == r2.autoStraighten
            && abs(r1.straightenAngle - r2.straightenAngle) < tolerance
            && abs(r1.teethWhiten - r2.teethWhiten) < tolerance
            && r1.subjectType == r2.subjectType
            && abs(r1.skinUnify - r2.skinUnify) < tolerance
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
            header
            slider
        }
        .padding(.vertical, 2)
    }

    private var header: some View {
        HStack {
            Label(title, systemImage: icon).font(.callout)
            Spacer()
            valuePill
        }
    }

    private var valuePill: some View {
        let isNeutral = value == 0
        return Text(format(value))
            .font(.footnote.monospaced())
            .foregroundStyle(isNeutral ? Color.secondary : Color.accentColor)
            .padding(.horizontal, 8)
            .padding(.vertical, 2)
            .background(
                (isNeutral ? Color.clear : Color.accentColor.opacity(0.1)),
                in: Capsule()
            )
    }

    private var slider: some View {
        Slider(value: $value, in: range) {
            EmptyView()
        } minimumValueLabel: {
            Text(rangeEndpointLabel(range.lowerBound))
                .font(.caption2)
                .foregroundStyle(.tertiary)
        } maximumValueLabel: {
            Text(rangeEndpointLabel(range.upperBound))
                .font(.caption2)
                .foregroundStyle(.tertiary)
        }
    }

    private func rangeEndpointLabel(_ v: Double) -> String {
        if v == 0 { return "0" }
        if v == -1 { return "−" }
        if v == 1 { return "+" }
        return "\(Int(v))"
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
    let currentColor: ColorLabel?
    let counts: Counts
    let colorCounts: [ColorLabel: Int]
    let onSelect: (LiveCaptureModel.FilmstripFilter) -> Void
    let onSelectColor: (ColorLabel?) -> Void

    var body: some View {
        HStack(spacing: 8) {
            chip(for: .all, count: counts.total)
            chip(for: .picks, count: counts.picks)
            chip(for: .fourPlus, count: counts.fourPlus)
            // Color filter row only surfaces when at least one shot in
            // the session has a color label set — keeps the bar uncluttered
            // for sessions where the photographer doesn't use them.
            if !colorCounts.isEmpty {
                Divider().frame(height: 14).padding(.horizontal, 4)
                colorChip(for: nil, count: counts.total)
                ForEach(ColorLabel.allCases, id: \.self) { label in
                    if let count = colorCounts[label], count > 0 {
                        colorChip(for: label, count: count)
                    }
                }
            }
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

    @ViewBuilder
    private func colorChip(for label: ColorLabel?, count: Int) -> some View {
        let isActive = currentColor == label
        Button {
            onSelectColor(label)
        } label: {
            HStack(spacing: 6) {
                if let label {
                    Circle()
                        .fill(Color.from(colorLabel: label))
                        .frame(width: 10, height: 10)
                } else {
                    Image(systemName: "circle.dashed")
                        .font(.caption2)
                        .foregroundStyle(.secondary)
                }
                Text("\(count)")
                    .font(.caption2.weight(.medium))
            }
            .foregroundStyle(isActive ? .white : .secondary)
            .padding(.horizontal, 8)
            .padding(.vertical, 5)
            .background(
                isActive ? Color.accentColor : .white.opacity(0.06),
                in: Capsule()
            )
        }
        .buttonStyle(.plain)
        .accessibilityLabel(label.map { "Filter color: \($0.rawValue)" } ?? "Clear color filter")
    }
}

private struct FilmstripRail: View {
    let assets: [Asset]
    let focusedAssetId: UUID?
    let compareAnchorId: UUID?
    let assetIdsWithReviews: Set<UUID>
    let onSelect: (Asset) -> Void
    let onDoubleTap: (Asset) -> Void
    let onLongPress: (Asset) -> Void

    var body: some View {
        ScrollViewReader { proxy in
            ScrollView(.horizontal, showsIndicators: false) {
                HStack(spacing: 10) {
                    ForEach(assets) { asset in
                        FilmstripTile(
                            asset: asset,
                            isFocused: asset.id == focusedAssetId,
                            isCompareAnchor: asset.id == compareAnchorId,
                            hasReviews: assetIdsWithReviews.contains(asset.id)
                        )
                        // Order matters — register double-tap before
                        // single-tap so the dispatcher waits for a
                        // possible second tap before firing single.
                        .onTapGesture(count: 2) { onDoubleTap(asset) }
                        .onTapGesture { onSelect(asset) }
                        .onLongPressGesture(minimumDuration: 0.4) {
                            onLongPress(asset)
                        }
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
    var isCompareAnchor: Bool = false
    var hasReviews: Bool = false

    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            ZStack(alignment: .topTrailing) {
                Group {
                    if let key = asset.displayPreviewKey, let image = UIImage(contentsOfFile: key) {
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
                            lineWidth: isCompareAnchor ? 3 : (isFocused ? 2.5 : (asset.flaggedForClient ? 2 : 1))
                        )
                }
                .overlay(alignment: .topLeading) {
                    if isCompareAnchor {
                        Text("A")
                            .font(.caption2.weight(.heavy))
                            .foregroundStyle(.white)
                            .frame(width: 18, height: 18)
                            .background(.orange, in: Circle())
                            .padding(6)
                    }
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
                } else if let pending = asset.pendingDetections, !pending.isEmpty {
                    // Slice 7 — pending review badge. Distinct purple
                    // capsule so the photographer can scan the strip
                    // and see which shots want a tap-to-confirm.
                    HStack(spacing: 2) {
                        Image(systemName: "checklist")
                            .font(.system(size: 9, weight: .heavy))
                        Text("\(pending.count)")
                            .font(.system(size: 10, weight: .heavy))
                    }
                    .foregroundStyle(.white)
                    .padding(.horizontal, 5)
                    .padding(.vertical, 2)
                    .background(.purple.opacity(0.9), in: Capsule())
                    .padding(6)
                } else if let count = asset.autoCleanedDetectionCount, count > 0 {
                    // Slice 4 — auto-clean badge. Shows count so the
                    // photographer knows at a glance how many pieces of
                    // equipment Claude removed from this shot.
                    HStack(spacing: 2) {
                        Image(systemName: "sparkles")
                            .font(.system(size: 9, weight: .heavy))
                        Text("\(count)")
                            .font(.system(size: 10, weight: .heavy))
                    }
                    .foregroundStyle(.white)
                    .padding(.horizontal, 5)
                    .padding(.vertical, 2)
                    .background(.teal.opacity(0.9), in: Capsule())
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
            .overlay(alignment: .bottomTrailing) {
                HStack(spacing: 4) {
                    if hasReviews {
                        Image(systemName: "bubble.left.fill")
                            .font(.system(size: 9, weight: .bold))
                            .foregroundStyle(.white)
                            .padding(3)
                            .background(.orange.opacity(0.9), in: Circle())
                    }
                    if asset.voiceMemoKey != nil {
                        Image(systemName: "mic.fill")
                            .font(.system(size: 9, weight: .bold))
                            .foregroundStyle(.white)
                            .padding(3)
                            .background(.blue.opacity(0.85), in: Circle())
                    }
                    if let label = asset.colorLabel {
                        Circle()
                            .fill(Color.from(colorLabel: label))
                            .frame(width: 12, height: 12)
                            .overlay(Circle().stroke(.white.opacity(0.85), lineWidth: 1))
                    }
                }
                .padding(8)
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
        if isCompareAnchor           { return .orange }
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

// MARK: - Detection review sheet (Slice 7)

/// Per-asset opt-in confirmation for distractions Claude found in
/// review-mode. Each detection is shown as a row with its type, an
/// 80-char description, and a confidence percent. All detections start
/// PRE-SELECTED so the photographer's natural action ("Bekreft") removes
/// everything Claude suggested — they untick the ones to keep, not the
/// other way around. Empty selection on confirm is a valid "dismiss
/// without inpainting" gesture and clears the pending queue.
private struct DetectionReviewSheet: View {
    let asset: Asset
    let onConfirm: (Set<String>) -> Void
    let onDismiss: () -> Void

    @State private var selected: Set<String> = []
    @State private var didInitialiseSelection: Bool = false

    private var detections: [PendingDetection] {
        asset.pendingDetections?.detections ?? []
    }

    private static let typeLabels: [String: String] = [
        "flash_strobe":      "Blits / modifier",
        "light_stand":       "Lys-stativ",
        "cable":             "Kabel",
        "boom_arm":          "Boom-arm",
        "tape_clip":         "Tape / klips",
        "sensor_dust":       "Sensor-støv",
        "other_distraction": "Annet",
    ]

    var body: some View {
        NavigationStack {
            VStack(spacing: 0) {
                if detections.isEmpty {
                    ContentUnavailableView(
                        "Ingen forslag",
                        systemImage: "checkmark.seal",
                        description: Text("Claude fant ingen utstyr å fjerne på denne shoten."),
                    )
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
                } else {
                    List {
                        Section {
                            ForEach(detections) { det in
                                Button {
                                    if selected.contains(det.id) { selected.remove(det.id) }
                                    else { selected.insert(det.id) }
                                } label: {
                                    HStack(alignment: .top, spacing: 12) {
                                        Image(systemName: selected.contains(det.id)
                                              ? "checkmark.circle.fill"
                                              : "circle")
                                            .font(.title3)
                                            .foregroundStyle(selected.contains(det.id) ? .purple : .secondary)
                                        VStack(alignment: .leading, spacing: 4) {
                                            HStack {
                                                Text(Self.typeLabels[det.type] ?? det.type)
                                                    .font(.subheadline.weight(.semibold))
                                                Spacer()
                                                Text("\(Int((det.confidence * 100).rounded()))%")
                                                    .font(.caption.monospacedDigit())
                                                    .foregroundStyle(.secondary)
                                            }
                                            if !det.description.isEmpty {
                                                Text(det.description)
                                                    .font(.caption)
                                                    .foregroundStyle(.secondary)
                                                    .fixedSize(horizontal: false, vertical: true)
                                            }
                                            Text("Bbox: \(det.bbox.x),\(det.bbox.y) · \(det.bbox.w)×\(det.bbox.h)")
                                                .font(.caption2.monospacedDigit())
                                                .foregroundStyle(.tertiary)
                                        }
                                    }
                                    .contentShape(Rectangle())
                                }
                                .buttonStyle(.plain)
                            }
                        } header: {
                            Text("\(detections.count) forslag fra Claude")
                        } footer: {
                            Text("Alle er valgt som default — fjern hak for ting du vil beholde i bildet.")
                                .font(.caption2)
                        }

                        Section {
                            Button("Velg alle") {
                                selected = Set(detections.map(\.id))
                            }
                            Button("Velg ingen") {
                                selected.removeAll()
                            }
                        }
                    }
                }
            }
            .navigationTitle("Vurder forslag")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Avbryt", action: onDismiss)
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button(selected.isEmpty ? "Forkast alle" : "Bekreft \(selected.count)") {
                        onConfirm(selected)
                    }
                    .disabled(detections.isEmpty)
                    .keyboardShortcut(.defaultAction)
                }
            }
            .onAppear {
                // Pre-select everything ONCE on first appear; subsequent
                // re-renders (asset stream re-emit) preserve the user's
                // edits so far.
                if !didInitialiseSelection {
                    selected = Set(detections.map(\.id))
                    didInitialiseSelection = true
                }
            }
        }
    }
}

private struct SettingsSheet: View {
    let currentURL: String
    let device: LiveCaptureModel.DeviceSummary?
    let sessionName: String
    let showHUD: Bool
    let onToggleHUD: () -> Void
    let autoCleanMode: AutoCleanMode
    let onSetAutoCleanMode: (AutoCleanMode) -> Void
    let clientReviewsEnabled: Bool
    let onToggleClientReviews: () -> Void
    let deliveryColorProfileTag: String
    let onSetDeliveryColorProfile: (String) -> Void
    let onRename: (String) -> Void
    let onDisconnect: () -> Void
    let onSignIn: () -> Void

    @Environment(SignInService.self) private var auth
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

                Section("Display") {
                    Toggle(isOn: .init(
                        get: { showHUD },
                        set: { _ in onToggleHUD() }
                    )) {
                        Label {
                            VStack(alignment: .leading, spacing: 2) {
                                Text("Photo Village overlays")
                                Text("Histogram · clipping · skin tone on the hero")
                                    .font(.caption).foregroundStyle(.secondary)
                            }
                        } icon: {
                            Image(systemName: "chart.bar.xaxis")
                        }
                    }
                    Picker(selection: .init(
                        get: { autoCleanMode },
                        set: { onSetAutoCleanMode($0) }
                    )) {
                        Label {
                            VStack(alignment: .leading, spacing: 1) {
                                Text("Av")
                                Text("Ingen automatisk fjerning")
                                    .font(.caption2).foregroundStyle(.secondary)
                            }
                        } icon: { Image(systemName: "circle.slash") }
                            .tag(AutoCleanMode.off)
                        Label {
                            VStack(alignment: .leading, spacing: 1) {
                                Text("Vurder forslag")
                                Text("Claude foreslår, du krysser av per shot før noe fjernes")
                                    .font(.caption2).foregroundStyle(.secondary)
                            }
                        } icon: { Image(systemName: "checklist") }
                            .tag(AutoCleanMode.review)
                        Label {
                            VStack(alignment: .leading, spacing: 1) {
                                Text("Auto-rens utstyr")
                                Text("Fjern detekterte objekter stille — du kan se original i viewer")
                                    .font(.caption2).foregroundStyle(.secondary)
                            }
                        } icon: { Image(systemName: "wand.and.stars") }
                            .tag(AutoCleanMode.autoClean)
                    } label: {
                        Text("Fjern objekter")
                    }
                    .pickerStyle(.inline)
                    .labelsHidden()
                }

                Section("Leverings-fargerom") {
                    Picker("Profil", selection: .init(
                        get: { deliveryColorProfileTag },
                        set: { onSetDeliveryColorProfile($0) }
                    )) {
                        Label {
                            VStack(alignment: .leading, spacing: 1) {
                                Text("Web (sRGB)")
                                Text("Universal — browsers + sosiale medier")
                                    .font(.caption2).foregroundStyle(.secondary)
                            }
                        } icon: { Image(systemName: "globe") }
                            .tag("web")
                        Label {
                            VStack(alignment: .leading, spacing: 1) {
                                Text("Wide-gamut (Display P3)")
                                Text("Apple-økosystem — Safari, iOS, macOS")
                                    .font(.caption2).foregroundStyle(.secondary)
                            }
                        } icon: { Image(systemName: "rectangle.fill.on.rectangle.fill") }
                            .tag("wide")
                        Label {
                            VStack(alignment: .leading, spacing: 1) {
                                Text("Print (Adobe RGB)")
                                Text("Foto-lab + RIP-software — IKKE for web")
                                    .font(.caption2).foregroundStyle(.secondary)
                            }
                        } icon: { Image(systemName: "printer.fill") }
                            .tag("print")
                    }
                    .pickerStyle(.inline)
                    .labelsHidden()
                }

                Section("Klient-tilbakemeldinger") {
                    Toggle(isOn: .init(
                        get: { clientReviewsEnabled },
                        set: { _ in onToggleClientReviews() }
                    )) {
                        Label {
                            VStack(alignment: .leading, spacing: 2) {
                                Text("Vis hjerter + kommentarer")
                                Text(clientReviewsEnabled
                                     ? "Bell-ikon, per-bilde-merker og review-mode er synlige"
                                     : "Skjuler all chrome — innkommende events ignoreres til du slår på igjen")
                                    .font(.caption).foregroundStyle(.secondary)
                                    .fixedSize(horizontal: false, vertical: true)
                            }
                        } icon: {
                            Image(systemName: clientReviewsEnabled ? "bubble.left.and.bubble.right.fill" : "bubble.left.and.bubble.right")
                        }
                    }
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

                Section("CreatorHub account") {
                    if let s = auth.session {
                        VStack(alignment: .leading, spacing: 2) {
                            Text(s.displayName).font(.body.weight(.semibold))
                            Text(s.email).font(.caption).foregroundStyle(.secondary)
                            Text(s.backendBaseURL.absoluteString)
                                .font(.caption2.monospaced())
                                .foregroundStyle(.tertiary)
                        }
                        Button(role: .destructive) {
                            auth.signOut()
                        } label: {
                            Label("Sign out", systemImage: "arrow.backward.circle")
                        }
                    } else {
                        Text("Not signed in — Deliver and AI photo enhancement need a CreatorHub account.")
                            .font(.footnote)
                            .foregroundStyle(.secondary)
                        Button(action: onSignIn) {
                            Label("Sign in to CreatorHub", systemImage: "person.crop.circle.badge.plus")
                        }
                    }
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

/// Fullscreen Photos-app-style asset viewer. Pages horizontally between
/// every asset in the session so the photographer can swipe through
/// shots without dropping back to the filmstrip.
///
/// Per-page interaction:
///   - Default scale = `fillScale` (image covers screen edge-to-edge).
///     Portrait shots on landscape iPad therefore arrive filled rather
///     than letterboxed — the explicit "dekke hele skjermen"-ask.
///   - Pinch-out below fill snaps to fit (scale=1, whole frame visible).
///   - Pinch-in zooms to detail; drag pans when scale > 1.
///   - Double-tap cycles fit ↔ fill (and snaps zoomed-in state back to
///     fill, matching Apple Photos).
///   - Single-tap toggles chrome (filename/time/close).
///
/// Pager-level: TabView page style with .never index display so the
/// background stays clean. Closing returns to the live capture surface.
private struct AssetViewerScreen: View {
    let assets: [Asset]
    let initialAssetId: UUID
    let onClose: () -> Void

    @State private var currentAssetId: UUID

    init(assets: [Asset], initialAssetId: UUID, onClose: @escaping () -> Void) {
        self.assets = assets
        self.initialAssetId = initialAssetId
        self.onClose = onClose
        _currentAssetId = State(initialValue: initialAssetId)
    }

    var body: some View {
        ZStack {
            Color.black.ignoresSafeArea()
            TabView(selection: $currentAssetId) {
                ForEach(assets) { asset in
                    AssetViewerPage(
                        asset: asset,
                        onClose: onClose,
                    )
                    .tag(asset.id)
                }
            }
            .tabViewStyle(.page(indexDisplayMode: .never))
            .ignoresSafeArea()
        }
    }
}

private struct AssetViewerPage: View {
    let asset: Asset
    let onClose: () -> Void

    /// Current zoom factor applied to a `.fit`-rendered image. Conceptual
    /// scale=1 is letterboxed-fit (whole frame visible); scale=fillScale
    /// is fill-the-screen (off-aspect content cropped). Initialized to
    /// `fillScale` on first layout so opening a portrait shot on a
    /// landscape iPad shows the photographer's image edge-to-edge instead
    /// of bookended by black bars.
    @State private var scale: CGFloat = 1
    /// Aspect-ratio-derived scale that promotes the `.fit`-rendered image
    /// to "fill the screen". Computed from `image.size` × container size
    /// in `onAppear`; nil before that so we don't apply a stale 1:1
    /// default while waiting for layout.
    @State private var fillScale: CGFloat?
    @State private var lastCommittedScale: CGFloat = 1
    @State private var offset: CGSize = .zero
    @State private var lastCommittedOffset: CGSize = .zero
    /// Photos-app-style chrome toggle. Single-tap hides filename + close
    /// button so the image fills the screen edge-to-edge.
    @State private var showChrome: Bool = true
    /// Slice 5 — when true, render the camera-original `previewKey`
    /// instead of the auto-cleaned variant. Per-shot only (no settings
    /// state), default false so the photographer sees the polished
    /// version first and opts in to the original when they want to
    /// verify what was removed. Banner at the bottom of the chrome
    /// surfaces the toggle only on shots that actually have a cleaned
    /// variant — non-cleaned shots see no extra UI.
    @State private var showOriginalDespiteCleaned: Bool = false

    /// Effective preview key for the viewer: cleaned-by-default, original
    /// when the photographer toggles. Falls back gracefully if either
    /// key is missing.
    private var effectivePreviewKey: String? {
        if showOriginalDespiteCleaned { return asset.previewKey ?? asset.autoCleanedKey }
        return asset.displayPreviewKey
    }
    private var hasCleanedVariant: Bool {
        asset.autoCleanedKey != nil
            && (asset.autoCleanedDetectionCount ?? 0) > 0
    }

    var body: some View {
        GeometryReader { geo in
            ZStack {
                Color.black.ignoresSafeArea()

                if let key = effectivePreviewKey, let image = UIImage(contentsOfFile: key) {
                    Image(uiImage: image)
                        .resizable()
                        .aspectRatio(contentMode: .fit)
                        .scaleEffect(scale)
                        .offset(offset)
                        .gesture(
                            MagnificationGesture()
                                .onChanged { value in
                                    scale = max(1, lastCommittedScale * value)
                                }
                                .onEnded { _ in
                                    lastCommittedScale = scale
                                    if scale < 1.05 {
                                        withAnimation(.spring) {
                                            scale = 1
                                            lastCommittedScale = 1
                                            offset = .zero
                                            lastCommittedOffset = .zero
                                        }
                                    }
                                }
                        )
                        .simultaneousGesture(
                            DragGesture()
                                .onChanged { value in
                                    // Pan only when zoomed beyond the
                                    // canonical viewing scale (fillScale).
                                    // At or below fill, the TabView's
                                    // page-swipe gesture wins so the
                                    // photographer can flip through
                                    // shots without fighting the image.
                                    let fill = fillScale ?? 1
                                    guard scale > fill * 1.05 else { return }
                                    offset = CGSize(
                                        width: lastCommittedOffset.width + value.translation.width,
                                        height: lastCommittedOffset.height + value.translation.height,
                                    )
                                }
                                .onEnded { _ in
                                    lastCommittedOffset = offset
                                    if scale < 1.05 {
                                        withAnimation(.spring) {
                                            offset = .zero
                                            lastCommittedOffset = .zero
                                        }
                                    }
                                }
                        )
                        .onAppear {
                            let computed = Self.computeFillScale(
                                imageSize: image.size,
                                containerSize: geo.size,
                            )
                            fillScale = computed
                            scale = computed
                            lastCommittedScale = computed
                            offset = .zero
                            lastCommittedOffset = .zero
                        }
                } else {
                    Text("Preview unavailable")
                        .foregroundStyle(.secondary)
                }

                if showChrome {
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
                        if hasCleanedVariant {
                            HStack(spacing: 12) {
                                Image(systemName: "sparkles")
                                    .foregroundStyle(.teal)
                                VStack(alignment: .leading, spacing: 1) {
                                    Text(showOriginalDespiteCleaned
                                         ? "Viser original"
                                         : "Auto-renset · \(asset.autoCleanedDetectionCount ?? 0) objekter fjernet")
                                        .font(.subheadline.weight(.semibold))
                                    Text(showOriginalDespiteCleaned
                                         ? "Trykk for å gå tilbake til renset versjon"
                                         : "Trykk for å se originalbildet")
                                        .font(.caption2)
                                        .foregroundStyle(.secondary)
                                }
                                Spacer()
                                Button {
                                    withAnimation(.easeInOut(duration: 0.2)) {
                                        showOriginalDespiteCleaned.toggle()
                                    }
                                } label: {
                                    Text(showOriginalDespiteCleaned ? "Vis renset" : "Vis original")
                                        .font(.subheadline.weight(.semibold))
                                        .padding(.horizontal, 14)
                                        .padding(.vertical, 8)
                                        .background(.teal.opacity(showOriginalDespiteCleaned ? 1 : 0.25), in: Capsule())
                                        .foregroundStyle(showOriginalDespiteCleaned ? .black : .white)
                                }
                            }
                            .padding()
                            .background(.ultraThinMaterial)
                        }
                    }
                    .transition(.move(edge: .top).combined(with: .opacity))
                }
            }
            .contentShape(Rectangle())
            // Order matters — register the double-tap (fit↔fill toggle)
            // first so the gesture system waits for a possible second
            // tap before resolving the single-tap (chrome toggle).
            .onTapGesture(count: 2) {
                withAnimation(.spring) {
                    let fill = fillScale ?? 1
                    let nextScale: CGFloat
                    if scale > fill * 1.05 {
                        nextScale = fill          // zoomed-in → back to fill
                    } else if abs(scale - fill) < 0.05 {
                        nextScale = 1             // fill → fit
                    } else {
                        nextScale = fill          // fit → fill
                    }
                    scale = nextScale
                    lastCommittedScale = nextScale
                    offset = .zero
                    lastCommittedOffset = .zero
                }
            }
            .onTapGesture(count: 1) {
                withAnimation(.easeInOut(duration: 0.2)) {
                    showChrome.toggle()
                }
            }
        }
    }

    /// Fill-scale = how much to scale a `.fit`-rendered image so that the
    /// shorter dimension hits the container edge instead of the longer
    /// one. For a portrait image on a landscape container this is >1
    /// (we scale up to fill width, cropping top/bottom); for a landscape
    /// image on a landscape container it's typically close to 1 already.
    private static func computeFillScale(imageSize: CGSize, containerSize: CGSize) -> CGFloat {
        guard imageSize.width > 0,
              imageSize.height > 0,
              containerSize.width > 0,
              containerSize.height > 0
        else { return 1 }
        let imageAspect = imageSize.width / imageSize.height
        let containerAspect = containerSize.width / containerSize.height
        return max(containerAspect / imageAspect, imageAspect / containerAspect)
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
            // Fire Claude Vision analysis the moment a preview lands. Once
            // per asset; failures are silent so the on-device pipeline result
            // remains the visible state if the backend is unreachable.
            scheduleAIAnalyses(after: oldValue)
            // Phase 2C activation gate. The CCAPI adapter only auto-enqueues
            // `.preview` for new shots — `.raw` is opt-in. Without this hook
            // every CR3 pick would land at deliver time with `rawKey == nil`
            // and the RAWExportService would silently fall back to the
            // display JPEG, defeating the whole pipeline. Diffing here (vs.
            // hooking individual UI sites) covers both `togglePick` and the
            // batch `CullStore.commit` path uniformly.
            scheduleRAWFetchesForNewlyFlaggedPicks(previous: oldValue)
            // WYSIWYG hook (Block C). When `rawKey` flips nil → set on
            // any asset, render a preview-quality JPEG via the same
            // CIRAWFilter pipeline that produces the gallery deliverable
            // and attach it as `enhancedKey`. Hero comparison-slider
            // then shows the photographer the actual demosaic, not
            // Canon's camera-baked JPEG with display-pipeline magic.
            scheduleRAWPreviewRenders(previous: oldValue)
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

    /// A/B compare mode — when set, the hero stage swaps to a two-up
    /// comparison panel anchored on this asset (A-side); the currently
    /// focused asset becomes the candidate (B-side). Set via long-press
    /// on a filmstrip thumbnail; cleared by the X button on the compare
    /// panel or when the anchor asset disappears from the session (e.g.
    /// after disconnect). Pro-photo workflow staple — picking between
    /// near-duplicate poses without thumbnail-eyeball-error.
    var compareAnchorAssetId: UUID?

    var compareAnchorAsset: Asset? {
        guard let id = compareAnchorAssetId else { return nil }
        return assets.first { $0.id == id }
    }

    /// True when both anchor + focus exist and they differ — that's the
    /// only state where the compare hero is meaningful.
    var isComparing: Bool {
        guard let anchor = compareAnchorAsset,
              let focus = focusedAsset
        else { return false }
        return anchor.id != focus.id
    }

    func setCompareAnchor(_ assetId: UUID?) {
        compareAnchorAssetId = assetId
    }

    func exitCompare() {
        compareAnchorAssetId = nil
    }

    /// Kick off a background analysis pass whenever the focused asset
    /// changes. Uses the UNenhanced preview so HUD reports the actual
    /// camera capture, not the post-Magic result.
    func refreshAnalysis(for asset: Asset?) {
        analysisTask?.cancel()
        guard let asset,
              let key = asset.previewKey,
              FileManager.default.fileExists(atPath: key)
        else {
            focusedAnalysis = nil
            return
        }
        let url = URL(fileURLWithPath: key)
        let analyser = self.analyser
        analysisTask = Task { [weak self] in
            let result = await analyser.analyze(imageURL: url)
            guard !Task.isCancelled, self?.focusedAssetId == asset.id else { return }
            await MainActor.run { self?.focusedAnalysis = result }
        }
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
    private let analyser = ImageAnalyser()
    private var analysisTask: Task<Void, Never>?
    /// Configured at connect time from UserDefaults. Nil = no backend, in
    /// which case the on-device pipeline is the only source of truth and
    /// no Claude Vision call is ever attempted.
    private var backendClient: BackendClient?
    /// One AI analyse task per asset, keyed by id. Cancel on teardown so
    /// a disconnect doesn't leave a 12-second backend call running.
    private var aiAnalyseTasks: [UUID: Task<Void, Never>] = [:]
    /// Track which assets we've already queued an AI analyse for, so a
    /// resync that re-emits the asset list doesn't fire duplicate calls.
    private var aiAnalyseDispatched: Set<UUID> = []

    /// On-set coaching signals for the currently focused asset. Cleared
    /// when focus changes; refreshed in background. Nil = no reading yet.
    var focusedAnalysis: ImageAnalysis?
    var showHUD: Bool = true
    /// Slice 4 + 7 — auto-clean mode picker. `.off` does nothing.
    /// `.autoClean` (Slice 4) auto-removes every detected distraction
    /// silently. `.review` (Slice 7) runs detect, stashes findings on
    /// `Asset.pendingDetections`, and shows a "💡 N forslag" badge on
    /// the filmstrip — photographer taps to review + confirm before
    /// any inpaint runs. Default `.off`.
    var autoCleanMode: AutoCleanMode = .off {
        didSet {
            if autoCleanMode != .off, oldValue == .off {
                // Sweep existing assets so a mid-shoot toggle-on still
                // catches everything that's already been delivered.
                dispatchAutoCleanForNewlyReadyAssets()
            }
        }
    }
    private var autoCleanService: AutoCleanService?
    /// Asset ids we've already kicked auto-clean for, so re-emissions
    /// of the assets stream don't fire duplicate detect calls.
    private var autoCleanDispatched: Set<UUID> = []
    private var downloadDirectory: URL?
    private var forwardingTasks: [Task<Void, Never>] = []
    /// Phase 2C — per-session RAW renderer. Built at connect time so it
    /// shares the session's download directory; injected into
    /// ``DeliveryService`` so picks with a `rawKey` get demosaiced through
    /// ``RAWExportPipeline`` at delivery time. Outside `#if DEBUG` because
    /// RAW delivery is a release-build feature.
    private var rawExportService: RAWExportService?
    /// Per-session voice memo recorder/player. Built at connect time
    /// so audio session lifecycle pairs cleanly with the shoot. Public
    /// so SwiftUI views can observe `.state` directly for record/play
    /// button affordances.
    var voiceMemoService: VoiceMemoService?
    /// Directory for chat-reply voice memos (distinct from per-asset
    /// memos so the two never collide). Lives under
    /// `tempDir/reply-memos/`. Built at connect time alongside
    /// `voiceMemoService`. Reply memo files outlive the
    /// `recentClientReviews` array because reviews can be re-emitted
    /// from server WebSocket while the file ID stays stable.
    var replyMemosDirectory: URL?

    /// Phase 5.4 — server-side AI enhancement job tracking. Keyed by
    /// LOCAL asset UUID (the picked asset's id on this iPad), value
    /// is the backend job id + last-known state. Populated after
    /// `deliver()` returns by `kickEnhancementForLastDelivery`; polled
    /// every ~5s by `enhancementPollTask` until all jobs reach a
    /// terminal state. UI surfaces "AI Enhanced" toggle in the hero
    /// when an asset's job hits "done" and we've downloaded the bytes.
    struct EnhancementJob: Equatable {
        let backendJobId: String
        var state: String
        var enhancedKey: String?
    }
    var enhancementJobs: [UUID: EnhancementJob] = [:]
    private var enhancementPollTask: Task<Void, Never>?
    /// User-scoped WebSocket subscription for client review events
    /// (`asset.hearted` / `asset.commented`). Built when both connect
    /// fires AND a backend session exists (signed-in). Carries the
    /// observer registration id so disconnect can cleanly tear it
    /// down. Phase 4 follow-up — closes the toveis-comm loop so the
    /// photographer sees client comments + hearts land in real time
    /// while still on-set.
    private var realtimeService: RealtimeEventService?
    private var realtimeObserverId: UUID?

    /// Phase 5.3 — multi-photographer presence. Tracks every other
    /// photographer currently connected to this session. Self-events
    /// (presence.joined where actorUserId == own userId) are filtered
    /// out at decode-time so the avatar row only shows peers.
    struct PresentPeer: Identifiable, Equatable, Hashable {
        let id: String        // userId — drives equality + dedup
        let displayName: String?
        let joinedAt: Date
    }
    var presentPeers: [PresentPeer] = []
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

    /// Where the active recipe for an asset came from. Drives the
    /// chip / badge UI so the photographer can tell at a glance whether
    /// they're looking at on-device baseline, Claude's refinement, or
    /// their own slider override.
    enum RecipeSource: Equatable { case baseline, aiRefined, userTuned }

    var recipeSource: [UUID: RecipeSource] = [:]

    /// Claude Vision results keyed by asset id. Populated asynchronously
    /// after the preview lands. Carries quality notes + caption suggestion
    /// the UI surfaces below the hero.
    var aiAnalyses: [UUID: BackendPhotoAnalysis] = [:]

    /// Quality-note pills the user has dismissed for a given asset, so a
    /// "soft focus" warning doesn't keep nagging once acknowledged.
    var dismissedNoteAssets: Set<UUID> = []

    /// Recipe currently in effect for an asset: tuned if set, else the
    /// auto-detected baseline from the pipeline, else neutral.
    func recipe(for assetId: UUID) -> MagicRecipe {
        if let tuned = tunedRecipes[assetId] { return tuned }
        #if DEBUG
        if let baseline = magicPipeline?.baselineRecipes[assetId] { return baseline }
        #endif
        return .neutral
    }

    /// User-driven tune from the slider panel. Always marks the recipe
    /// as user-tuned so the AI badge gets demoted — the photographer's
    /// hand on the slider wins over Claude's recommendation.
    ///
    /// Two render passes when raw is available:
    ///   1. ``MagicPipeline.retune`` writes a display-JPEG-derived
    ///      version to `enhancedKey` in ~200 ms — gives instant
    ///      visual feedback while the slider is still being dragged.
    ///   2. ``triggerRAWPreviewRetune`` debounces 300 ms then renders
    ///      a true WYSIWYG version through `RAWExportPipeline`, which
    ///      lands a second or two later and overwrites `enhancedKey`
    ///      with the demosaic-based bytes the client gallery will
    ///      actually receive. Cancellable: subsequent slider drags
    ///      kill the in-flight RAW render before it commits, so the
    ///      photographer never sees a stale RAW lag behind the live
    ///      display preview.
    func tune(assetId: UUID, recipe: MagicRecipe) {
        tunedRecipes[assetId] = recipe
        recipeSource[assetId] = .userTuned
        #if DEBUG
        if let sourcePath = assets.first(where: { $0.id == assetId })?.previewKey {
            magicPipeline?.retune(assetId: assetId, recipe: recipe, sourcePath: sourcePath)
        }
        #endif
        triggerRAWPreviewRetune(assetId: assetId, recipe: recipe)
    }

    /// Per-asset debounced RAW retune tasks. Cancelled before each new
    /// slider tick so a long-running demosaic doesn't land after the
    /// photographer has moved on to a new recipe value.
    private var rawPreviewRetuneTasks: [UUID: Task<Void, Never>] = [:]

    /// Phase 4 follow-up — re-render the RAW preview when the
    /// photographer tunes a recipe, so WYSIWYG holds beyond the
    /// initial download. No-op when the asset has no raw bytes yet
    /// (display-JPEG-Magic is the only path); no-op when the
    /// `RAWExportService` isn't configured (offline/demo modes).
    private func triggerRAWPreviewRetune(assetId: UUID, recipe: MagicRecipe) {
        guard let exporter = rawExportService, let store else { return }
        guard let asset = assets.first(where: { $0.id == assetId }) else { return }

        // Resolve which asset's rawKey to demosaic from. Picked-JPG
        // case: the CR3 sibling holds the bytes; output keys to the
        // JPG row (mirrors `scheduleRAWPreviewRenders`).
        let primaryAssetId = assetId
        let sourceAssetId: UUID
        if Self.isRawCapture(filename: asset.originalFilename) {
            sourceAssetId = asset.id
        } else if let sibling = Self.siblingRawAsset(for: asset, in: assets) {
            sourceAssetId = sibling.id
        } else {
            return  // no raw bytes anywhere — nothing to retune
        }
        // Quick guard: if neither source nor primary has rawKey on
        // disk, skip (e.g. raw download still in flight; the
        // assets.didSet hook will pick this up when the bytes land).
        guard
            let sourceAsset = assets.first(where: { $0.id == sourceAssetId }),
            sourceAsset.rawKey != nil
        else { return }

        rawPreviewRetuneTasks[primaryAssetId]?.cancel()
        rawPreviewRetuneTasks[primaryAssetId] = Task { [weak self, exporter, store] in
            // Debounce — let the slider stop moving before we burn
            // 1-3 s of demosaic compute. Slider-drag emits onChange
            // events at ~60 Hz; without the debounce we'd queue
            // dozens of RAW renders in a fraction of a second.
            try? await Task.sleep(for: .milliseconds(300))
            if Task.isCancelled { return }
            do {
                let url = try await exporter.renderPreview(
                    assetId: primaryAssetId,
                    sourceAssetId: sourceAssetId,
                    recipe: recipe,
                )
                if Task.isCancelled { return }
                try await store.attachEnhancedKey(id: primaryAssetId, key: url.path)
            } catch {
                print("[LiveCaptureModel] RAW preview retune failed for \(primaryAssetId): \(error)")
                _ = self
            }
        }
    }

    /// Reset to the best available baseline. If Claude provided a
    /// confident recipe we fall back to that (still labelled .aiRefined);
    /// otherwise the on-device subject classifier's pick.
    func resetRecipe(assetId: UUID) {
        tunedRecipes.removeValue(forKey: assetId)
        recipeSource[assetId] = .baseline
        if let analysis = aiAnalyses[assetId], analysis.confidence >= 0.5 {
            let claude = magicRecipe(from: analysis.suggestedRecipe)
            tunedRecipes[assetId] = claude
            recipeSource[assetId] = .aiRefined
            #if DEBUG
            if let sourcePath = assets.first(where: { $0.id == assetId })?.previewKey {
                magicPipeline?.retune(assetId: assetId, recipe: claude, sourcePath: sourcePath)
            }
            #endif
            triggerRAWPreviewRetune(assetId: assetId, recipe: claude)
            return
        }
        let baselineRecipe: MagicRecipe = {
            #if DEBUG
            if let baseline = magicPipeline?.baselineRecipes[assetId] { return baseline }
            #endif
            return .neutral
        }()
        triggerRAWPreviewRetune(assetId: assetId, recipe: baselineRecipe)
        #if DEBUG
        guard let sourcePath = assets.first(where: { $0.id == assetId })?.previewKey,
              let baseline = magicPipeline?.baselineRecipes[assetId]
        else { return }
        magicPipeline?.retune(assetId: assetId, recipe: baseline, sourcePath: sourcePath)
        #endif
    }

    func dismissNotes(assetId: UUID) {
        dismissedNoteAssets.insert(assetId)
    }

    /// Selects filter applied to the filmstrip. The source array stays
    /// complete so ratings/flags from currently-hidden assets still persist.
    var filmstripFilter: FilmstripFilter = .all
    /// Optional color-label narrowing applied on top of `filmstripFilter`.
    /// nil = "any color (incl. unlabeled)". Set this from the color filter
    /// chips so a photographer can isolate e.g. all picks tagged green.
    var filmstripColorFilter: ColorLabel? = nil

    enum FilmstripFilter: String, CaseIterable, Equatable {
        case all     = "All"
        case picks   = "Picks"
        case fourPlus = "4★ and up"
    }

    var filteredAssets: [Asset] {
        let base: [Asset]
        switch filmstripFilter {
        case .all:     base = assets
        case .picks:   base = assets.filter { $0.flaggedForClient && !$0.rejected }
        case .fourPlus: base = assets.filter { $0.rating >= 4 && !$0.rejected }
        }
        guard let color = filmstripColorFilter else { return base }
        return base.filter { $0.colorLabel == color }
    }

    /// Identity for local SQLite rows. When the user has signed into
    /// CreatorHub via SignInService we tag every session/asset with their
    /// actual userId so a future delivery to UniversalShowcase ends up in
    /// their account. When signed-out we fall back to a stable local
    /// pseudonym so the app still works as a pure local tether.
    private var actorUserId: String {
        SignInService.shared.session?.userId ?? "local-photographer"
    }

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
            self.backendClient = makeBackendClientFromDefaults()
            if let backend = self.backendClient {
                self.autoCleanService = AutoCleanService(store: store, backend: backend)
            }
            self.rawExportService = RAWExportService(
                store: store,
                outputDirectory: tempDir.appendingPathComponent("raw-export"),
            )
            self.voiceMemoService = VoiceMemoService(
                outputDirectory: tempDir.appendingPathComponent("voice-memos"),
            )
            self.replyMemosDirectory = tempDir.appendingPathComponent("reply-memos")
            try? FileManager.default.createDirectory(
                at: tempDir.appendingPathComponent("reply-memos"),
                withIntermediateDirectories: true,
            )

            // Phase 4 — start the user-scoped realtime socket so
            // client `asset.hearted` / `asset.commented` events land
            // in `recentClientReviews` while the photographer is
            // still on-set. Skipped when not signed in (offline mode
            // keeps the rest of the app functional; reviews simply
            // never arrive until next sign-in).
            if let session = SignInService.shared.session {
                let realtime = RealtimeEventService()
                self.realtimeService = realtime
                let wsURL = session.backendBaseURL.appendingPathComponent("/api/ipad/ws/events")
                await realtime.start(url: wsURL, bearerToken: session.bearer)
                let observerId = await realtime.addObserver { [weak self] event in
                    Task { @MainActor in
                        self?.recordClientReview(event)
                    }
                }
                self.realtimeObserverId = observerId
                // Phase 5.3 — announce presence so other iPads in
                // this session add an avatar for us. Fire-and-forget;
                // server retries the broadcast naturally on the next
                // markPresent heartbeat.
                if let backend = self.backendClient {
                    Task { [backend, sessionId = dbSession.id, name = session.displayName] in
                        try? await backend.broadcastPresence(
                            sessionId: sessionId, joining: true, displayName: name,
                        )
                    }
                }
            }

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
                    await MainActor.run {
                        self?.assets = assets
                        self?.dispatchAutoCleanForNewlyReadyAssets()
                    }
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

    /// Set or clear the per-asset color label. Lightroom-style cull
    /// signal — typically red=drop, yellow=needs-retouch, green=ready,
    /// blue=client-favorite, purple=portfolio. Pass `nil` to clear.
    /// Re-tapping the same color via the hero swatch row clears (handled
    /// by the caller comparing current vs new before invoking).
    /// Phase 5 — photographer-selectable delivery color profile.
    /// Persisted via UserDefaults so it survives app restart, and
    /// flows into every `DeliverableAsset.colorPurpose` so each
    /// pick gets demosaiced + tagged with the chosen ICC profile.
    /// Three options:
    ///   * `web` (default) → sRGB, universal browser compatibility
    ///   * `wide` → Display P3, Apple-ecosystem-honored wider gamut
    ///   * `print` → Adobe RGB (1998), photo-lab + RIP standard
    /// String-backed for AppStorage; conversion to
    /// `ColorManagement.Purpose` happens at render time.
    var deliveryColorProfileTag: String {
        get { UserDefaults.standard.string(forKey: "capture.deliveryColorProfile") ?? "web" }
        set { UserDefaults.standard.set(newValue, forKey: "capture.deliveryColorProfile") }
    }
    var deliveryColorPurpose: ColorManagement.Purpose {
        switch deliveryColorProfileTag {
        case "wide": return .wideGamutDelivery
        case "print": return .printDelivery
        default:     return .webDelivery
        }
    }

    /// Master gate for the entire client-review surface — bell badge,
    /// per-tile indicators, inbox sheet, review-mode side rail, and
    /// inbound event recording. When false the photographer never sees
    /// review chrome (mid-shoot focus mode, or shoots where the share
    /// link doesn't grant review permission). The toggle lives in the
    /// Settings sheet; default true. Note: this is iPad-side
    /// suppression only — TODO for full disable is to gate the share
    /// token's clientAuth scope at backend `createClientToken` time so
    /// the public gallery hides the comment box too.
    var clientReviewsEnabled: Bool = true

    /// Recent client reviews (hearts + comments) for assets in this
    /// session. Populated from the user-scoped WebSocket
    /// (`asset.hearted` / `asset.commented` events) once realtime is
    /// wired into `LiveCaptureModel`, plus from demo-mode injection in
    /// the auto-demo task. Newest first; capped at 50 entries to bound
    /// memory on long shoots.
    var recentClientReviews: [ClientReview] = []

    var unreadReviewCount: Int {
        recentClientReviews.filter { $0.unread }.count
    }

    /// Set of asset IDs that have received at least one review in this
    /// session — used by FilmstripTile to draw a persistent comment-
    /// bubble badge so the photographer can see "this shot got
    /// feedback" even after the inbox is opened (read-state clears
    /// the unread bell badge but per-tile signal stays).
    var assetIdsWithReviews: Set<UUID> {
        Set(recentClientReviews.map(\.assetId))
    }

    /// Sustained review-mode flag. Hero stage swaps to a split pane
    /// (image left, comment side-rail right) for focused review of
    /// what the client is saying about a specific shot. Mutually
    /// exclusive with compare-mode — entering one auto-exits the
    /// other, so the photographer never has three stages fighting
    /// for the hero area.
    var isReviewMode: Bool = false

    func enterReviewMode(focusAssetId: UUID? = nil) {
        compareAnchorAssetId = nil  // exit compare if active
        if let id = focusAssetId, assets.contains(where: { $0.id == id }) {
            focusedAssetId = id
        } else if let firstReviewedId = recentClientReviews.first?.assetId,
                  assets.contains(where: { $0.id == firstReviewedId }) {
            focusedAssetId = firstReviewedId
        }
        isReviewMode = true
        markReviewsRead()
    }

    func exitReviewMode() {
        isReviewMode = false
    }

    /// Append a review notification for the given event. Skips events
    /// that don't reference an asset in the current session, so a
    /// shared user-scoped socket carrying reviews from multiple shoots
    /// only surfaces what's relevant here. No-op when reviews are
    /// disabled via Settings — events still arrive but stay invisible
    /// (the photographer asked for quiet).
    func recordClientReview(_ event: UserEvent) {
        // Phase 5.3 — presence + label-change events route here too.
        // We dispatch BEFORE the clientReviewsEnabled gate because
        // presence tracking is independent of review surface (turning
        // off reviews shouldn't make assistant photographers vanish).
        switch event {
        case .presenceJoined(let p):
            handlePresenceJoined(p)
            return
        case .presenceLeft(let p):
            handlePresenceLeft(p)
            return
        case .assetLabelsChanged(let p):
            handleAssetLabelsChanged(p)
            return
        default:
            break
        }
        guard clientReviewsEnabled else { return }
        let review: ClientReview? = {
            switch event {
            case .assetHearted(let p):
                guard let assetUUID = UUID(uuidString: p.assetId),
                      let asset = assets.first(where: { $0.id == assetUUID })
                else { return nil }
                return ClientReview(
                    id: UUID(),
                    assetId: assetUUID,
                    assetFilename: asset.originalFilename,
                    kind: .heart(on: p.hearted),
                    senderKind: .client,
                    displayName: p.clientName,
                    timestamp: p.timestamp,
                    unread: true,
                )
            case .assetCommented(let p):
                guard let assetUUID = UUID(uuidString: p.assetId),
                      let asset = assets.first(where: { $0.id == assetUUID })
                else { return nil }
                return ClientReview(
                    id: UUID(),
                    assetId: assetUUID,
                    assetFilename: asset.originalFilename,
                    kind: .comment(preview: p.preview),
                    senderKind: .client,
                    displayName: p.clientName,
                    timestamp: p.timestamp,
                    unread: true,
                )
            case .presenceJoined, .presenceLeft, .assetLabelsChanged,
                 .quoteSigned, .contractSigned, .shotCaptured,
                 .shotCompletionToggled, .unknown:
                return nil
            }
        }()
        guard let review else { return }
        // Echo dedup — when the server broadcasts our own photographer
        // reply back over the user-scoped socket, we'd otherwise
        // double-insert. Match against any photographer-side review
        // for the same asset with identical comment text within the
        // last 30 s; if found, treat the incoming event as the echo
        // and skip. Heart events don't dedupe (photographer-side
        // hearts aren't a feature yet, so any incoming heart is
        // genuinely from the client).
        if case .comment(let preview) = review.kind {
            let cutoff = Date().addingTimeInterval(-30)
            let isEcho = recentClientReviews.contains { existing in
                guard existing.senderKind == .photographer,
                      existing.assetId == review.assetId,
                      existing.timestamp >= cutoff,
                      case .comment(let existingText) = existing.kind
                else { return false }
                return existingText == preview
            }
            if isEcho { return }
        }
        recentClientReviews.insert(review, at: 0)
        if recentClientReviews.count > 50 {
            recentClientReviews.removeLast(recentClientReviews.count - 50)
        }
    }

    /// Demo-only convenience — synthesize a review without going through
    /// the WebSocket. Called from `--auto-demo`'s task so screenshots
    /// can show the bell + inbox populated. Production code routes
    /// through `recordClientReview(_:)` from a real `UserEvent`.
    func injectDemoReview(
        assetId: UUID,
        assetFilename: String,
        kind: ClientReview.Kind,
        senderKind: ClientReview.SenderKind = .client,
        displayName: String,
    ) {
        guard clientReviewsEnabled else { return }
        let review = ClientReview(
            id: UUID(),
            assetId: assetId,
            assetFilename: assetFilename,
            kind: kind,
            senderKind: senderKind,
            displayName: displayName,
            timestamp: Date(),
            // Photographer's own replies don't count as unread to
            // herself — only the client side adds to the bell badge.
            unread: senderKind == .client,
        )
        recentClientReviews.insert(review, at: 0)
        if recentClientReviews.count > 50 {
            recentClientReviews.removeLast(recentClientReviews.count - 50)
        }
    }

    /// Scope for batch recipe application. Picks the photographer's
    /// most likely intent: "the shots that already passed cull" first,
    /// then "the rated keepers", then "everything in the session"
    /// (broad but quick).
    enum RecipeApplyScope {
        case allFlagged
        case allFourPlus
        case entireSession

        func count(in assets: [Asset]) -> Int {
            switch self {
            case .allFlagged:
                return assets.filter { $0.flaggedForClient && !$0.rejected }.count
            case .allFourPlus:
                return assets.filter { $0.rating >= 4 && !$0.rejected }.count
            case .entireSession:
                return assets.filter { !$0.rejected }.count
            }
        }

        var label: String {
            switch self {
            case .allFlagged:    return "Alle picks"
            case .allFourPlus:   return "Alle 4★+"
            case .entireSession: return "Hele sesjonen"
            }
        }

        var icon: String {
            switch self {
            case .allFlagged:    return "flag.fill"
            case .allFourPlus:   return "star.fill"
            case .entireSession: return "tray.full.fill"
            }
        }
    }

    /// Apply `recipe` to every asset matching `scope` (excluding the
    /// already-tuned source asset, which the photographer just left
    /// in its target state). Each target asset gets its own recipe
    /// state, recipeSource flipped to `.userTuned`, and a
    /// MagicPipeline.retune kicked off so the hero/filmstrip update
    /// in step. Lightroom-style batch sync — turns "I tuned this
    /// portrait perfectly" into "all twenty portraits from this set
    /// look the same" with one tap.
    func applyRecipeToSelection(
        recipe: MagicRecipe,
        scope: RecipeApplyScope,
        sourceAssetId: UUID,
    ) {
        let targets: [Asset]
        switch scope {
        case .allFlagged:
            targets = assets.filter { $0.flaggedForClient && !$0.rejected }
        case .allFourPlus:
            targets = assets.filter { $0.rating >= 4 && !$0.rejected }
        case .entireSession:
            targets = assets.filter { !$0.rejected }
        }
        for asset in targets where asset.id != sourceAssetId {
            tune(assetId: asset.id, recipe: recipe)
        }
    }

    /// Slice 7 — DetectionReviewSheet calls this after the photographer
    /// ticks which pending detections to actually remove. Hands off to
    /// the service which runs the inpaint with the chosen subset and
    /// clears the pending queue. Empty `selected` is a valid commit —
    /// it dismisses the review without inpainting and marks the asset
    /// "ran clean, 0 removed".
    func commitPendingDetections(assetId: UUID, selected: Set<String>) async {
        guard let service = autoCleanService,
              let downloadDir = downloadDirectory,
              let asset = assets.first(where: { $0.id == assetId })
        else { return }
        await service.processConfirmedDetections(
            asset: asset,
            selectedDetectionIds: selected,
            downloadDir: downloadDir,
        )
    }

    /// Slice 4 + 7 — fire AutoCleanService for any asset that has its
    /// preview JPEG attached and hasn't been processed yet. Called
    /// from the assets-stream observer (every emission) and from the
    /// `autoCleanMode` setter (so flipping the toggle on mid-shoot
    /// retroactively sweeps existing assets).
    ///
    /// No-ops when:
    ///   - the mode is .off,
    ///   - the service hasn't been built (no backend client / not signed in),
    ///   - we don't have a download directory (pre-connect).
    /// All checks are cheap so calling this on every assets emission
    /// is fine — it only enqueues work when something has actually
    /// transitioned to "preview ready and unseen".
    private func dispatchAutoCleanForNewlyReadyAssets() {
        guard autoCleanMode != .off,
              let service = autoCleanService,
              let downloadDir = downloadDirectory
        else { return }
        let mode = autoCleanMode
        for asset in assets {
            // Skip assets already processed (auto-cleaned) OR awaiting
            // review (pending detections set). The review-mode skip
            // matters: an assets-stream re-emission shouldn't kick a
            // fresh detect when the photographer hasn't acted on the
            // previous one yet.
            guard asset.previewKey != nil,
                  asset.autoCleanedDetectionCount == nil,
                  asset.pendingDetections == nil,
                  !autoCleanDispatched.contains(asset.id)
            else { continue }
            autoCleanDispatched.insert(asset.id)
            Task.detached(priority: .utility) {
                await service.processAsset(asset, downloadDir: downloadDir, mode: mode)
            }
        }
    }

    /// Phase 5.4 — after `deliver` (or `deliverToShowcase`) returns,
    /// resolve the local→backend asset id mapping for each pick and
    /// fire `requestEnhancement` for the lot. Then start the poll
    /// task. Idempotent: re-running with the same picks gets the same
    /// job IDs back from the backend dedup, and we only seed
    /// `enhancementJobs` for assetIds we don't already track.
    func kickEnhancementForLastDelivery(_ result: DeliveryService.DeliveryResult) async {
        guard let backend = backendClient,
              let delivery = deliveryService
        else { return }
        // Reverse the delivery's idMap (local UUID → backend UUID) so
        // we can submit the backend ids to enhance-picks.
        var localToBackend: [UUID: String] = [:]
        for asset in assets where asset.flaggedForClient && !asset.rejected {
            if let backendId = await delivery.backendAssetId(forLocal: asset.id) {
                localToBackend[asset.id] = backendId.uuidString.lowercased()
            }
        }
        guard !localToBackend.isEmpty else { return }
        do {
            let response = try await backend.requestEnhancement(
                sessionId: result.backendSessionId,
                body: BackendEnhancePicksRequest(
                    assetIds: Array(localToBackend.values),
                    preset: nil,
                ),
            )
            // Map backend asset id (lowercase string) back to local
            // UUID so enhancementJobs stays keyed by local id.
            let backendToLocal = Dictionary(uniqueKeysWithValues:
                localToBackend.map { ($0.value, $0.key) })
            for mapping in response.jobs {
                guard let localId = backendToLocal[mapping.assetId] else { continue }
                if enhancementJobs[localId] == nil {
                    enhancementJobs[localId] = EnhancementJob(
                        backendJobId: mapping.jobId,
                        state: "queued",
                        enhancedKey: nil,
                    )
                }
            }
            startEnhancementPolling(sessionId: result.backendSessionId)
        } catch {
            // Non-fatal — picks are already delivered. Surface a quiet
            // hint so the photographer knows AI-enhanced versions
            // won't appear, but no toast (deliver-success was the
            // load-bearing UX).
            print("[LiveCaptureModel] Enhancement kickoff failed: \(error)")
        }
    }

    private func startEnhancementPolling(sessionId: UUID) {
        enhancementPollTask?.cancel()
        let serverDownloadDir = downloadDirectory?
            .appendingPathComponent("server-enhanced")
        try? serverDownloadDir.map {
            try FileManager.default.createDirectory(at: $0, withIntermediateDirectories: true)
        }
        enhancementPollTask = Task { [weak self] in
            // Poll every 5 s until all tracked jobs hit a terminal
            // state (done/failed/cancelled). Cap the loop at ~10 min
            // (120 cycles) so we don't burn battery on stuck jobs.
            for _ in 0..<120 {
                try? await Task.sleep(for: .seconds(5))
                guard let self else { return }
                if Task.isCancelled { return }
                if await self.allEnhancementJobsTerminal() { return }
                await self.tickEnhancementPoll(sessionId: sessionId, downloadDir: serverDownloadDir)
            }
        }
    }

    private func allEnhancementJobsTerminal() -> Bool {
        let terminal: Set<String> = ["done", "failed", "cancelled"]
        return enhancementJobs.values.allSatisfy { terminal.contains($0.state) }
    }

    private func tickEnhancementPoll(sessionId: UUID, downloadDir: URL?) async {
        guard let backend = backendClient, let store else { return }
        let response: BackendEnhancementStatusResponse
        do {
            response = try await backend.fetchEnhancementStatus(sessionId: sessionId)
        } catch {
            return  // transient network — try again next tick
        }
        // Build backendId → localId reverse map from current state.
        let reverseMap: [String: UUID] = Dictionary(
            uniqueKeysWithValues: enhancementJobs.compactMap { local, job -> (String, UUID)? in
                response.jobs.first(where: { $0.jobId == job.backendJobId })
                    .map { ($0.assetId, local) }
            },
        )
        for status in response.jobs {
            guard let localId = reverseMap[status.assetId] else { continue }
            var job = enhancementJobs[localId] ?? EnhancementJob(
                backendJobId: status.jobId, state: status.state, enhancedKey: nil,
            )
            let stateChanged = job.state != status.state
            job.state = status.state
            // If just transitioned to "done", download the bytes +
            // attach as serverEnhancedKey so the hero comparison
            // slider can offer the AI version alongside Magic.
            if status.state == "done", job.enhancedKey == nil,
               let urlString = status.enhancedUrl,
               let url = URL(string: urlString),
               let downloadDir {
                let dest = downloadDir.appendingPathComponent("\(localId.uuidString).jpg")
                if let data = try? await URLSession.shared.data(from: url).0 {
                    try? data.write(to: dest, options: .atomic)
                    job.enhancedKey = dest.path
                    try? await store.attachServerEnhancedKey(id: localId, key: dest.path)
                }
            }
            if stateChanged || job.enhancedKey != nil {
                enhancementJobs[localId] = job
            }
        }
    }

    /// Photographer-side reply to a client conversation. Locally
    /// inserts the message immediately so the side rail updates
    /// in-step with the send action, then POSTs to the backend in a
    /// detached task so the photographer's input never blocks on
    /// network. Empty/whitespace-only replies no-op.
    ///
    /// Backend POST only fires once the asset has been delivered
    /// (`DeliveryService.idMap` carries local → backend asset id);
    /// for un-delivered shots the local insert is the only side
    /// effect — the reply will land on the server next time delivery
    /// runs and includes this asset. The backend echo arrives over
    /// the user-scoped WebSocket (`asset.commented` event), which
    /// `recordClientReview(_:)` could double-insert; we dedupe by
    /// sender+timestamp+text in a TODO follow-up. For now the local
    /// insert is the source of truth on this iPad.
    /// Phase 5.1 — voice-memo reply. Same fire-and-forget split as
    /// the text reply: local insert immediately so the side rail
    /// updates on send, then a detached upload-and-POST task that
    /// pushes the m4a to backend R2 + records the review with
    /// `audioKey` set. Backend POST is best-effort; if it fails the
    /// local bubble stays so the photographer can retry by sending
    /// again. Echo-dedup in `recordClientReview` matches incoming
    /// audio events back against this local insert via `(senderKind,
    /// timestamp window, audio path)`.
    func sendPhotographerVoiceReply(
        assetId: UUID,
        audioURL: URL,
        durationSeconds: Double,
    ) {
        guard clientReviewsEnabled,
              let asset = assets.first(where: { $0.id == assetId })
        else { return }
        let displayName = SignInService.shared.session?.displayName
            ?? SignInService.shared.session?.email
        let review = ClientReview(
            id: UUID(),
            assetId: assetId,
            assetFilename: asset.originalFilename,
            kind: .audio(localPath: audioURL.path, durationSeconds: durationSeconds),
            senderKind: .photographer,
            displayName: displayName,
            timestamp: Date(),
            unread: false,
        )
        recentClientReviews.insert(review, at: 0)
        if recentClientReviews.count > 50 {
            recentClientReviews.removeLast(recentClientReviews.count - 50)
        }

        guard let backend = backendClient,
              let delivery = deliveryService
        else { return }
        Task { [weak self] in
            guard let backendAssetId = await delivery.backendAssetId(forLocal: assetId) else {
                return
            }
            do {
                let data = try Data(contentsOf: audioURL)
                _ = try await backend.submitAssetVoiceReview(
                    assetId: backendAssetId,
                    audioData: data,
                    audioMimeType: "audio/m4a",
                    durationSeconds: durationSeconds,
                )
            } catch {
                await MainActor.run {
                    self?.errorMessage = "Stemme-svar lagret lokalt — backend nektet (\(error.localizedDescription))"
                }
            }
        }
    }

    func sendPhotographerReply(assetId: UUID, comment: String) {
        let trimmed = comment.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty,
              clientReviewsEnabled,
              let asset = assets.first(where: { $0.id == assetId })
        else { return }
        let displayName = SignInService.shared.session?.displayName
            ?? SignInService.shared.session?.email
        let review = ClientReview(
            id: UUID(),
            assetId: assetId,
            assetFilename: asset.originalFilename,
            kind: .comment(preview: trimmed),
            senderKind: .photographer,
            displayName: displayName,
            timestamp: Date(),
            unread: false,
        )
        recentClientReviews.insert(review, at: 0)
        if recentClientReviews.count > 50 {
            recentClientReviews.removeLast(recentClientReviews.count - 50)
        }

        guard let backend = backendClient,
              let delivery = deliveryService
        else { return }
        Task { [weak self] in
            guard let backendAssetId = await delivery.backendAssetId(forLocal: assetId) else {
                // Not yet delivered → nothing to attach a review to
                // server-side. Local-only is the correct degradation.
                return
            }
            do {
                _ = try await backend.submitAssetReview(
                    assetId: backendAssetId,
                    body: BackendCreateReviewRequest(
                        heart: nil,
                        rating: nil,
                        comment: trimmed,
                    ),
                )
            } catch {
                // Surface a quiet error so the photographer knows the
                // server didn't ack their reply, but don't roll back
                // the local insert — they can manually retry by
                // sending again. Background sync (Outbox-style) is a
                // Phase 5 follow-up.
                await MainActor.run {
                    self?.errorMessage = "Svar lagret lokalt — backend nektet (\(error.localizedDescription))"
                }
            }
        }
    }

    /// Phase 5.3 — multi-photographer presence handlers.
    private func handlePresenceJoined(_ p: UserEvent.PresenceInfo) {
        guard let currentSessionId,
              p.sessionId.lowercased() == currentSessionId.uuidString.lowercased()
        else { return }
        // Filter self-events. The backend fans `presence.joined` to
        // every photographer in the session including the joiner so
        // their other devices catch up; without this gate we'd render
        // an avatar for ourselves.
        if let selfId = SignInService.shared.session?.userId,
           p.actorUserId == selfId {
            return
        }
        let peer = PresentPeer(
            id: p.actorUserId,
            displayName: p.displayName,
            joinedAt: p.timestamp,
        )
        if let existing = presentPeers.firstIndex(where: { $0.id == peer.id }) {
            presentPeers[existing] = peer
        } else {
            presentPeers.append(peer)
        }
    }

    private func handlePresenceLeft(_ p: UserEvent.PresenceLeft) {
        guard let currentSessionId,
              p.sessionId.lowercased() == currentSessionId.uuidString.lowercased()
        else { return }
        presentPeers.removeAll { $0.id == p.actorUserId }
    }

    /// Reconcile a peer's label change into local state. We patch
    /// SessionStore directly so GRDB's assets stream re-emits and
    /// the UI updates in step. Suppress self-events so we don't
    /// clobber an in-flight optimistic local update with a stale
    /// echo of our own toggle.
    private func handleAssetLabelsChanged(_ p: UserEvent.AssetLabelsChange) {
        guard let currentSessionId,
              p.sessionId.lowercased() == currentSessionId.uuidString.lowercased()
        else { return }
        if let selfId = SignInService.shared.session?.userId,
           p.actorUserId == selfId {
            return
        }
        guard let assetUUID = UUID(uuidString: p.assetId),
              let store
        else { return }
        Task {
            try? await store.updateAssetLabels(
                id: assetUUID,
                rating: p.rating,
                colorLabel: p.colorLabel.flatMap { ColorLabel(rawValue: $0) }.map { Optional($0) },
                flaggedForClient: p.flaggedForClient,
                rejected: p.rejected,
            )
        }
    }

    func markReviewsRead() {
        for i in recentClientReviews.indices {
            recentClientReviews[i].unread = false
        }
    }

    func setColorLabel(assetId: UUID, label: ColorLabel?) async {
        guard let store else { return }
        do {
            try await store.updateAssetLabels(
                id: assetId,
                colorLabel: .some(label),
            )
        } catch {
            errorMessage = "Color label failed: \(error.localizedDescription)"
        }
    }

    /// Begin recording a voice memo for `assetId`. Stops any in-flight
    /// recording/playback. The 60 s cap auto-finalizes; manual stop via
    /// ``stopVoiceMemoRecording`` is the typical path.
    func startVoiceMemoRecording(assetId: UUID) {
        guard let voiceMemoService, let store else { return }
        voiceMemoService.startRecording(assetId: assetId) { url in
            guard let url else { return }
            Task { try? await store.attachVoiceMemoKey(id: assetId, key: url.path) }
        }
    }

    /// Stop in-flight recording for `assetId` (no-op if not recording
    /// this asset) and persist the memo path on the asset row.
    func stopVoiceMemoRecording(assetId: UUID) {
        guard let voiceMemoService, let store else { return }
        voiceMemoService.stopRecordingAndFinalize(assetId: assetId) { url in
            guard let url else { return }
            Task { try? await store.attachVoiceMemoKey(id: assetId, key: url.path) }
        }
    }

    /// Toggle playback of `assetId`'s memo. If already playing this
    /// memo, stops; if playing a different memo, switches to this one.
    func toggleVoiceMemoPlayback(assetId: UUID) {
        guard let voiceMemoService else { return }
        if case .playing(let id) = voiceMemoService.state, id == assetId {
            voiceMemoService.stopPlayback()
        } else {
            voiceMemoService.startPlayback(assetId: assetId)
        }
    }

    /// Delete `assetId`'s voice memo file + clear the path on the row.
    func deleteVoiceMemo(assetId: UUID) {
        guard let voiceMemoService, let store else { return }
        voiceMemoService.deleteMemo(for: assetId)
        Task { try? await store.attachVoiceMemoKey(id: assetId, key: nil) }
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

    // MARK: - Deliver + Archive (Phase 2B)

    enum PickFilter: String, CaseIterable, Equatable, Sendable {
        case flagged   = "Picks (flag)"
        case fourPlus  = "4★ and up"
        case picksAndFourPlus = "Picks + 4★"
        case all       = "All non-rejected"
    }

    /// Lazy-allocated mirror of the backend client, lives only as long
    /// as the connected session. Rebuilt on connect because authHeaders
    /// can change between sessions.
    private var deliveryService: DeliveryService?

    /// Last successful delivery — surfaces in the sheet so the photographer
    /// can re-share the same link without re-uploading.
    var lastDelivery: DeliveryService.DeliveryResult?

    /// Last successful showcase delivery — used to short-circuit the
    /// upload step on re-share. Distinct from the legacy Capture-token
    /// path above so each surface owns its own redo state.
    var lastShowcaseDelivery: DeliveryService.ShowcaseDeliveryResult?

    /// Mirrors the local session state for the archive sheet. Loaded on
    /// open via `loadArchivedSessions()` so we don't keep a live stream.
    var archivedSessions: [Session] = []
    var isLoadingArchive: Bool = false

    /// The CreatorHub project this session belongs to. Set by the
    /// ProjectSelectionView right after sign-in. When non-nil:
    ///   - shot list panel shows the project's planned shots
    ///   - DeliverSheet pre-fills clientName/email/projectTitle
    ///   - the Capture session row's projectId column is set on backend
    ///     (via BackendClient.linkSessionToProject after session create)
    var selectedProject: BackendProjectSummary?

    /// Full project detail (with shot list) — loaded lazily after the
    /// summary lands so the shot list panel can render shots[]. Nil
    /// when the project hasn't been opened yet, or when no project is
    /// selected.
    var selectedProjectDetail: BackendProjectDetail?

    /// Count of assets that match the default delivery filter (picks +
    /// 4★ that aren't rejected). Drives the badge on the Deliver button.
    var deliverablePicksCount: Int {
        deliverablePicks(filter: .picksAndFourPlus).count
    }

    /// Deliver button stays disabled until the photographer has actually
    /// picked something AND a backend is configured to ship to. Better to
    /// hide capability than to surface "Network failed" as the first feedback.
    var canDeliver: Bool {
        backendClient != nil && deliverablePicksCount > 0
    }

    func deliverablePicks(filter: PickFilter) -> [Asset] {
        switch filter {
        case .flagged:
            return assets.filter { $0.flaggedForClient && !$0.rejected }
        case .fourPlus:
            return assets.filter { $0.rating >= 4 && !$0.rejected }
        case .picksAndFourPlus:
            return assets.filter { ($0.flaggedForClient || $0.rating >= 4) && !$0.rejected }
        case .all:
            return assets.filter { !$0.rejected }
        }
    }

    /// Run the deliver flow. Mirror session, upload picks (preview JPEGs
    /// only — Phase 2C handles full/RAW), mint a client token. Returns the
    /// result and stashes it in `lastDelivery` so the sheet can re-show
    /// the URL without retriggering the upload.
    func deliver(
        filter: PickFilter,
        clientLabel: String?,
        pin: String?,
        ttlMinutes: Int?,
    ) async throws -> DeliveryService.DeliveryResult {
        guard let backend = backendClient else {
            throw DeliveryService.DeliveryError.tokenMintFailed("backend not configured")
        }
        let service = deliveryService ?? DeliveryService(backend: backend, rawExporter: rawExportService)
        deliveryService = service

        let allFlagged = deliverablePicks(filter: filter)
        let allAssets = self.assets
        let picks = allFlagged
            .compactMap { asset -> DeliveryService.DeliverableAsset? in
                // RAW+JPG dedup: if this is a raw row whose JPG sibling
                // is also flagged, skip — the JPG row will carry this
                // raw as `rawSourceAssetId` and a single upload covers
                // the shot. Otherwise raw stays as a first-class pick.
                if Self.isRawCapture(filename: asset.originalFilename),
                   let jpgSibling = Self.siblingJpgAsset(for: asset, in: allFlagged),
                   allFlagged.contains(where: { $0.id == jpgSibling.id }) {
                    return nil
                }
                guard let previewKey = asset.previewKey,
                      FileManager.default.fileExists(atPath: previewKey)
                else { return nil }
                let rawSibling = Self.siblingRawAsset(for: asset, in: allAssets)
                return DeliveryService.DeliverableAsset(
                    localId: asset.id,
                    originalFilename: asset.originalFilename,
                    captureTime: asset.captureTime,
                    mime: "image/jpeg",
                    previewPath: previewKey,
                    renderRecipe: recipe(for: asset.id),
                    colorPurpose: deliveryColorPurpose,
                    rawSourceAssetId: rawSibling?.id,
                )
            }
        guard !picks.isEmpty else {
            throw DeliveryService.DeliveryError.noUploadablePicks
        }

        let result = try await service.deliver(
            sessionName: sessionName,
            sessionStartedAt: assets.first?.captureTime ?? Date(),
            picks: picks,
            clientLabel: clientLabel,
            pin: pin,
            ttlMinutes: ttlMinutes,
        )
        await MainActor.run { self.lastDelivery = result }
        // Phase 5.4 — fire-and-forget AI enhancement for the just-
        // delivered picks. Failures don't block the deliver result;
        // the gallery URL is what matters for the photographer in
        // the moment, AI-enhanced versions land minutes later.
        Task { [weak self] in
            await self?.kickEnhancementForLastDelivery(result)
        }
        return result
    }

    /// Pick a project to attach this session to. Loads the full detail
    /// (with shot list) in the background so the shot list panel can
    /// render shots[] right away.
    func selectProject(_ summary: BackendProjectSummary) {
        selectedProject = summary
        sessionName = summary.title
        Task { await loadProjectDetail(projectId: summary.id) }
    }

    func clearSelectedProject() {
        selectedProject = nil
        selectedProjectDetail = nil
    }

    private func loadProjectDetail(projectId: String) async {
        guard let backend = backendClient else { return }
        do {
            let detail = try await backend.fetchProject(projectId: projectId)
            await MainActor.run {
                self.selectedProjectDetail = detail
            }
        } catch {
            // Non-fatal — the summary already has enough for the picker;
            // shot list panel just shows "couldn't load" state.
        }
    }

    /// Push a manual shot-completion toggle from `ShotListPanel` to the
    /// backend so other surfaces (dashboard progress bar, second iPad,
    /// photographer's phone) agree on what's left to shoot. Throws on
    /// failure so the caller can roll back the optimistic UI flip.
    /// Backend session UUID, if a delivery has run for this shoot
    /// (DeliveryService creates it lazily on first `deliver()`). Used
    /// by the Live Set dashboard to fetch captured-asset thumbnails;
    /// `nil` before any delivery means the dashboard renders the
    /// shot-list as all-missing tiles, which is correct — those assets
    /// haven't been mirrored to backend yet.
    func currentBackendSessionId() async -> UUID? {
        await deliveryService?.backendSessionId
    }

    /// The backend client used by SignInService — exposed read-only so
    /// the dashboard sheet can build its own LiveSetDashboardModel
    /// without re-instantiating signing config.
    var currentBackendClient: BackendClient? { backendClient }

    func setShotCompletion(shotId: String, isCompleted: Bool) async throws {
        guard let backend = backendClient,
              let projectId = selectedProject?.id
        else {
            throw BackendError.notConfigured
        }
        try await backend.setShotCompletion(
            projectId: projectId,
            shotId: shotId,
            isCompleted: isCompleted,
        )
        // Pull authoritative post-toggle state so the shot-list panel's
        // progress bar + must-have counter react to the flip. Server did
        // the recompute; we just replace our snapshot rather than trying
        // to patch counters in-place.
        await loadProjectDetail(projectId: projectId)
    }

    /// Link the live capture session row on the backend to the chosen
    /// project. Called after the DeliveryService has mirrored the
    /// session to the backend. Idempotent — safe to call multiple times
    /// per session.
    func linkSessionToSelectedProject(backendSessionId: UUID) async {
        guard let backend = backendClient,
              let projectId = selectedProject?.id
        else { return }
        do {
            try await backend.linkSessionToProject(
                sessionId: backendSessionId,
                projectId: projectId,
            )
        } catch {
            errorMessage = "Couldn't attach session to project: \(error.localizedDescription)"
        }
    }

    /// End-to-end Phase 2B deliver: upload picks → bridge into a
    /// CreatorHub UniversalShowcase gallery → return shareable URL.
    /// The URL targets the standard `/client/gallery/<token>` viewer
    /// the photographer's regular delivery flow uses, so the iPad
    /// deliveries land in the same dashboard as everything else.
    func deliverToShowcase(
        filter: BackendDeliverFilter,
        clientName: String,
        clientEmail: String,
        projectTitle: String?,
    ) async throws -> DeliveryService.ShowcaseDeliveryResult {
        guard let backend = backendClient else {
            throw DeliveryService.DeliveryError.bridgeFailed("backend not configured — sign in to CreatorHub first")
        }
        let service = deliveryService ?? DeliveryService(backend: backend, rawExporter: rawExportService)
        deliveryService = service

        let localFilter: PickFilter = {
            switch filter {
            case .flagged:        return .flagged
            case .ratingAtLeast4: return .fourPlus
            case .picksOr4Plus:   return .picksAndFourPlus
            case .allNonRejected: return .all
            }
        }()
        let allFlagged = deliverablePicks(filter: localFilter)
        let allAssets = self.assets
        let picks = allFlagged
            .compactMap { asset -> DeliveryService.DeliverableAsset? in
                if Self.isRawCapture(filename: asset.originalFilename),
                   let jpgSibling = Self.siblingJpgAsset(for: asset, in: allFlagged),
                   allFlagged.contains(where: { $0.id == jpgSibling.id }) {
                    return nil
                }
                guard let previewKey = asset.previewKey,
                      FileManager.default.fileExists(atPath: previewKey)
                else { return nil }
                let rawSibling = Self.siblingRawAsset(for: asset, in: allAssets)
                return DeliveryService.DeliverableAsset(
                    localId: asset.id,
                    originalFilename: asset.originalFilename,
                    captureTime: asset.captureTime,
                    mime: "image/jpeg",
                    previewPath: previewKey,
                    renderRecipe: recipe(for: asset.id),
                    colorPurpose: deliveryColorPurpose,
                    rawSourceAssetId: rawSibling?.id,
                )
            }
        guard !picks.isEmpty else {
            throw DeliveryService.DeliveryError.noUploadablePicks
        }

        let result = try await service.deliverToShowcase(
            sessionName: sessionName,
            sessionStartedAt: assets.first?.captureTime ?? Date(),
            picks: picks,
            clientName: clientName,
            clientEmail: clientEmail,
            projectTitle: projectTitle,
            filter: filter,
        )
        await MainActor.run { self.lastShowcaseDelivery = result }
        return result
    }

    /// Build the share URL the photographer hands to the client. Reads
    /// `capture.clientShareBaseURL` from UserDefaults — settable via the
    /// settings sheet. Falls back to a placeholder so the sheet shows
    /// *something* rather than nothing.
    func clientShareURL(token: BackendCreatedClientToken) -> URL {
        let base = UserDefaults.standard.string(forKey: "capture.clientShareBaseURL")
            ?? "https://capture.creatorhubn.com/c"
        var components = URLComponents(string: base) ?? URLComponents()
        var existing = components.queryItems ?? []
        existing.append(URLQueryItem(name: "t", value: token.token))
        components.queryItems = existing
        return components.url ?? URL(string: "\(base)?t=\(token.token)")!
    }

    /// Load the local SQLite session list for the archive sheet. Doesn't
    /// touch the backend — archive is purely a local-state surface.
    func loadArchivedSessions() async {
        guard let store else {
            await MainActor.run { self.archivedSessions = [] }
            return
        }
        await MainActor.run { self.isLoadingArchive = true }
        let rows = (try? await store.listSessions(ownerUserId: actorUserId)) ?? []
        await MainActor.run {
            self.archivedSessions = rows
            self.isLoadingArchive = false
        }
    }

    /// Mark the current local session as closed. Stops the magic pipeline
    /// but leaves the camera connected — photographer can keep shooting in
    /// a new session if they want, or disconnect. Idempotent.
    func closeCurrentSession() async {
        guard let store, let sessionId = currentSessionId else { return }
        do {
            try await store.closeSession(id: sessionId)
        } catch {
            errorMessage = "Couldn't close session: \(error.localizedDescription)"
        }
    }

    // MARK: - Claude Vision (Phase 2A)

    /// Read backend baseURL + auth headers from SignInService. Absence
    /// (signed-out state) means "skip the backend call entirely" — the
    /// app stays fully functional offline; Claude Vision and Deliver
    /// simply don't fire. This is the source of truth for "are we
    /// connected to CreatorHub" everywhere in LiveCaptureModel.
    private func makeBackendClientFromDefaults() -> BackendClient? {
        guard let session = SignInService.shared.session else { return nil }
        return BackendClient(
            baseURL: session.backendBaseURL,
            authHeaders: ["Authorization": "Bearer \(session.bearer)"]
        )
    }

    /// Walk newly-arrived previews and dispatch one AI analyse per asset.
    /// Called from `assets.didSet` so we don't need a separate stream.
    /// Phase 2C activation hook — request a `.raw` download for each pick
    /// that just flipped flagged on, provided RAW bytes are reachable and
    /// not already on disk. Runs on every `assets` diff so it catches
    /// both interactive (`togglePick`) and batch (`CullStore.commit`)
    /// flagging paths uniformly.
    ///
    /// Two cases:
    ///   1. Picked asset is itself a Canon RAW (CR3/CR2) → enqueue `.raw`
    ///      on its own id.
    ///   2. Picked asset is a JPG with a sibling RAW (dual RAW+JPG shoot,
    ///      Canon emits both files via separate CCAPI URLs) → enqueue
    ///      `.raw` on the sibling's id so the high-quality bytes land
    ///      under the sibling's row, where `DeliveryService` will fetch
    ///      them via `rawSourceAssetId`.
    ///
    /// The adapter de-dupes per (assetId, kind), so re-running across
    /// stream ticks is safe. Failures are silent — RAW is always
    /// best-effort; if the camera disconnects mid-download,
    /// ``DeliveryService`` falls back to the display JPEG without the
    /// user seeing a delivery error.
    private func scheduleRAWFetchesForNewlyFlaggedPicks(previous: [Asset]) {
        guard let cameraSession else { return }
        let previousFlagged: [UUID: Bool] = Dictionary(
            uniqueKeysWithValues: previous.map { ($0.id, $0.flaggedForClient) },
        )
        for asset in assets {
            guard asset.flaggedForClient,
                  previousFlagged[asset.id] != true
            else { continue }

            let rawTarget: UUID?
            if Self.isRawCapture(filename: asset.originalFilename) {
                rawTarget = asset.rawKey == nil ? asset.id : nil
            } else if let sibling = Self.siblingRawAsset(for: asset, in: assets) {
                rawTarget = sibling.rawKey == nil ? sibling.id : nil
            } else {
                rawTarget = nil
            }

            guard let id = rawTarget else { continue }
            Task {
                try? await cameraSession.fetch(assetId: id, priority: .raw)
            }
        }
    }

    /// Lower-cased extension match for Canon's RAW formats. CR3 covers
    /// every R-series body in the validated test matrix; CR2 is the
    /// legacy DSLR format kept here so a 5D-class body wouldn't silently
    /// degrade to display-JPEG-only delivery if Daniel ever tethers one.
    private static func isRawCapture(filename: String) -> Bool {
        let ext = (filename as NSString).pathExtension.lowercased()
        return ext == "cr3" || ext == "cr2"
    }

    /// Find a sibling RAW asset for a JPG row when shooting RAW+JPG dual.
    /// Canon CCAPI exposes the two formats as separate content URLs with
    /// matching basenames (e.g. `IMG_1234.JPG` + `IMG_1234.CR3`). The
    /// match is basename-only (case-insensitive); a future sibling that
    /// shoots into the same session under the same basename overrides
    /// stale earlier assets, but in practice each basename appears once.
    /// Returns nil for assets that already are RAW (no self-pairing) or
    /// JPGs without a corresponding RAW row.
    private static func siblingRawAsset(for asset: Asset, in assets: [Asset]) -> Asset? {
        guard !isRawCapture(filename: asset.originalFilename) else { return nil }
        let basename = (asset.originalFilename as NSString)
            .deletingPathExtension
            .lowercased()
        guard !basename.isEmpty else { return nil }
        return assets.first { other in
            guard other.id != asset.id,
                  isRawCapture(filename: other.originalFilename)
            else { return false }
            let otherBase = (other.originalFilename as NSString)
                .deletingPathExtension
                .lowercased()
            return otherBase == basename
        }
    }

    /// WYSIWYG-preview render trigger. For each asset whose `rawKey`
    /// just flipped nil → set, kick off a preview-size demosaic via
    /// `RAWExportService.renderPreview` and attach the resulting path
    /// to `enhancedKey`. The hero's existing ComparisonSlider then
    /// uses the RAW-rendered version as the "after" side, replacing
    /// MagicPipeline's display-JPEG-derived enhancement. Photographer
    /// finally sees what the client will receive in the gallery,
    /// not Canon's in-camera JPEG processing.
    ///
    /// One-shot per asset transition: the diff guard means re-runs of
    /// this method (which fires on every assets-stream tick) won't
    /// re-render an asset whose RAW already arrived earlier. For
    /// post-tune-slider re-renders, see Phase D follow-up — this MVP
    /// covers the auto-render at download-complete time only.
    private func scheduleRAWPreviewRenders(previous: [Asset]) {
        guard let exporter = rawExportService, let store else { return }
        let previousRawKeys: [UUID: String?] = Dictionary(
            uniqueKeysWithValues: previous.map { ($0.id, $0.rawKey) },
        )
        for asset in assets {
            // Only act on the rawKey transition. If the asset was
            // hosted earlier with rawKey already set, our preview is
            // either already on disk or is from a previous session;
            // skip to avoid re-rendering on every stream tick.
            let oldRawKey = previousRawKeys[asset.id] ?? nil
            guard let _ = asset.rawKey,
                  oldRawKey == nil
            else { continue }

            // For dual RAW+JPG shoots, render under the JPG row's id
            // when the asset is the JPG sibling — keeps the visual
            // pairing tight (the picked JPG row's hero updates with
            // the demosaic, not the CR3 row).
            let primaryAssetId: UUID
            let sourceAssetId: UUID
            if Self.isRawCapture(filename: asset.originalFilename) {
                if let jpgSibling = Self.siblingJpgAsset(for: asset, in: assets) {
                    primaryAssetId = jpgSibling.id
                    sourceAssetId = asset.id
                } else {
                    primaryAssetId = asset.id
                    sourceAssetId = asset.id
                }
            } else {
                continue  // shouldn't reach — non-raw rows shouldn't have rawKey set
            }

            let recipe = self.recipe(for: primaryAssetId)
            Task { [weak self, exporter, store] in
                do {
                    let url = try await exporter.renderPreview(
                        assetId: primaryAssetId,
                        sourceAssetId: sourceAssetId,
                        recipe: recipe,
                    )
                    try await store.attachEnhancedKey(id: primaryAssetId, key: url.path)
                } catch {
                    // Silent — the existing display-JPEG-enhanced path
                    // remains as a perfectly usable fallback. Logged
                    // below so devs can see render failures during
                    // bring-up without disturbing the photographer.
                    print("[LiveCaptureModel] RAW preview render failed for \(primaryAssetId): \(error)")
                    _ = self
                }
            }
        }
    }

    /// Inverse of `siblingRawAsset` — given a RAW asset, find a sibling
    /// JPG. Used for delivery dedup: if both rows of a dual shoot are
    /// flagged we want to upload only the JPG row (with the RAW as
    /// source) rather than uploading the same scene twice.
    private static func siblingJpgAsset(for raw: Asset, in assets: [Asset]) -> Asset? {
        guard isRawCapture(filename: raw.originalFilename) else { return nil }
        let basename = (raw.originalFilename as NSString)
            .deletingPathExtension
            .lowercased()
        guard !basename.isEmpty else { return nil }
        return assets.first { other in
            guard other.id != raw.id,
                  !isRawCapture(filename: other.originalFilename)
            else { return false }
            let otherBase = (other.originalFilename as NSString)
                .deletingPathExtension
                .lowercased()
            return otherBase == basename
        }
    }

    private func scheduleAIAnalyses(after old: [Asset]) {
        guard backendClient != nil else { return }
        let oldKeys: [UUID: String?] = Dictionary(uniqueKeysWithValues: old.map { ($0.id, $0.previewKey) })
        for asset in assets {
            guard !aiAnalyseDispatched.contains(asset.id),
                  let previewKey = asset.previewKey,
                  FileManager.default.fileExists(atPath: previewKey)
            else { continue }
            // Only fire when previewKey transitions from nil → set, OR on
            // a brand-new asset we haven't seen before.
            let wasReady = (oldKeys[asset.id] ?? nil) != nil
            let isNew = oldKeys[asset.id] == nil
            guard isNew || !wasReady else { continue }
            aiAnalyseDispatched.insert(asset.id)
            dispatchAIAnalyse(assetId: asset.id, previewKey: previewKey)
        }
    }

    private func dispatchAIAnalyse(assetId: UUID, previewKey: String) {
        guard let backend = backendClient else { return }
        aiAnalyseTasks[assetId]?.cancel()
        let task = Task { [weak self] in
            guard let self else { return }
            // Wait briefly so the on-device pipeline gets first paint —
            // the user always sees Magic's instant render and Claude's
            // refinement only lands after, never replacing a blank hero.
            try? await Task.sleep(for: .milliseconds(400))
            if Task.isCancelled { return }
            guard
                let data = try? Data(contentsOf: URL(fileURLWithPath: previewKey)),
                !data.isEmpty
            else { return }
            let mime = previewKey.lowercased().hasSuffix(".png") ? "image/png" : "image/jpeg"
            let base64 = data.base64EncodedString()
            do {
                let response = try await backend.analyzeImage(
                    assetId: assetId,
                    imageBase64: base64,
                    mime: mime,
                )
                if Task.isCancelled { return }
                await MainActor.run {
                    self.applyAIAnalysis(assetId: assetId, response: response)
                }
            } catch {
                // Silent fallback: the on-device recipe stays in effect.
                // Keeping the dispatched flag set means we don't retry on
                // every assets refresh — a single shot per asset is plenty,
                // the user can tune by hand if Claude wasn't reachable.
            }
        }
        aiAnalyseTasks[assetId] = task
    }

    /// Apply Claude's recommendation. Skipped silently when:
    ///   - the user has already moved sliders (userTuned wins)
    ///   - confidence is below 0.5 (Claude is guessing)
    /// Otherwise stores the analysis (so notes/caption surface in the UI),
    /// pushes the recipe through the on-device pipeline, and marks the
    /// recipe as `.aiRefined` so the badge reflects it.
    private func applyAIAnalysis(assetId: UUID, response: BackendAnalyzeResponse) {
        aiAnalyses[assetId] = response.analysis
        guard recipeSource[assetId] != .userTuned else { return }
        guard response.analysis.confidence >= 0.5 else { return }
        let claude = magicRecipe(from: response.analysis.suggestedRecipe)
        tunedRecipes[assetId] = claude
        recipeSource[assetId] = .aiRefined
        #if DEBUG
        if let sourcePath = assets.first(where: { $0.id == assetId })?.previewKey {
            magicPipeline?.retune(assetId: assetId, recipe: claude, sourcePath: sourcePath)
        }
        #endif
        // Phase 4 follow-up: also kick a RAW preview retune so the
        // hero's WYSIWYG version reflects Claude's recipe (not just
        // the display-JPEG-Magic). Same debounced + cancellable
        // path used by manual tune-slider edits.
        triggerRAWPreviewRetune(assetId: assetId, recipe: claude)
    }

    private func magicRecipe(from wire: BackendSuggestedRecipe) -> MagicRecipe {
        MagicRecipe(
            warmth: wire.warmth,
            skinHighFreq: wire.skinHighFreq ?? 0,
            skinLowFreq: wire.skinLowFreq ?? 0,
            skinSmooth: wire.skinSmooth,
            shadowLift: wire.shadowLift,
            contrast: wire.contrast,
            saturation: wire.saturation,
            highlightRecovery: wire.highlightRecovery ?? 0,
            eyeSharpen: wire.eyeSharpen ?? 0,
            eyeCatchlight: wire.eyeCatchlight ?? 0,
            autoStraighten: wire.autoStraighten ?? false,
            straightenAngle: wire.straightenAngle ?? 0,
            teethWhiten: wire.teethWhiten ?? 0,
            subjectType: wire.subjectType.flatMap { MagicRecipe.SubjectType(rawValue: $0) } ?? .none,
            skinUnify: wire.skinUnify ?? 0
        )
    }

    private func teardown() async {
        if let cameraSession {
            await cameraSession.stop()
        }
        for task in forwardingTasks { task.cancel() }
        forwardingTasks.removeAll()
        for task in aiAnalyseTasks.values { task.cancel() }
        aiAnalyseTasks.removeAll()
        aiAnalyseDispatched.removeAll()
        backendClient = nil
        deliveryService = nil
        lastDelivery = nil
        lastShowcaseDelivery = nil
        selectedProject = nil
        selectedProjectDetail = nil
        archivedSessions = []
        isLoadingArchive = false
        aiAnalyses.removeAll()
        recipeSource.removeAll()
        dismissedNoteAssets.removeAll()
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
        for task in rawPreviewRetuneTasks.values { task.cancel() }
        rawPreviewRetuneTasks.removeAll()
        enhancementPollTask?.cancel()
        enhancementPollTask = nil
        enhancementJobs.removeAll()
        rawExportService = nil
        voiceMemoService?.reset()
        voiceMemoService = nil
        replyMemosDirectory = nil
        if let realtime = realtimeService, let observerId = realtimeObserverId {
            Task { await realtime.removeObserver(observerId) }
        }
        if let realtime = realtimeService {
            Task { await realtime.stop() }
        }
        realtimeService = nil
        realtimeObserverId = nil
        // Phase 5.3 — fire presence-leave so peer iPads drop us
        // immediately rather than waiting for the 5-min stale-cleanup.
        if let backend = backendClient, let sessionId = currentSessionId {
            Task { [backend, sessionId] in
                try? await backend.broadcastPresence(
                    sessionId: sessionId, joining: false, displayName: nil,
                )
            }
        }
        presentPeers.removeAll()
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

// MARK: - Deliver sheet

/// Phase 2B: bridge picks into a CreatorHub UniversalShowcase gallery.
/// Three states walk the user through the flow:
///   1. Configure — pick filter, client name + email, project title.
///   2. Working   — progress bar while we mirror session + upload picks
///                  + create the gallery on the backend.
///   3. Done      — CreatorHub gallery URL + iOS share sheet hook.
///
/// Failures map back to state 1 with an error banner so the photographer
/// can adjust + retry without losing their input.
private struct DeliverSheet: View {
    @Bindable var model: LiveCaptureModel
    @Environment(SignInService.self) private var auth
    @Environment(\.dismiss) private var dismiss

    @State private var filter: BackendDeliverFilter = .picksOr4Plus
    @State private var clientName: String = ""
    @State private var clientEmail: String = ""
    @State private var projectTitle: String = ""
    @State private var didPrefill: Bool = false
    @State private var phase: Phase = .configure
    @State private var errorMessage: String?
    @State private var result: DeliveryService.ShowcaseDeliveryResult?
    @State private var showShareSheet: Bool = false

    private enum Phase: Equatable { case configure, working, done }

    var body: some View {
        NavigationStack {
            Group {
                if !auth.isSignedIn {
                    notSignedInView
                } else {
                    switch phase {
                    case .configure: configureView
                    case .working:   workingView
                    case .done:      doneView
                    }
                }
            }
            .navigationTitle("Deliver to client")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button(phase == .done ? "Done" : "Cancel") { dismiss() }
                }
            }
            .onAppear {
                // Prefill from the active project so the photographer
                // doesn't re-type details that already live in CreatorHub.
                // Only on the first onAppear so manual edits aren't
                // overwritten when the sheet re-presents.
                if !didPrefill, let project = model.selectedProject {
                    if clientName.isEmpty { clientName = project.clientName ?? "" }
                    if projectTitle.isEmpty { projectTitle = project.title }
                    didPrefill = true
                }
                // If we already delivered this session, jump straight to the
                // share view rather than re-running the upload.
                if let prior = model.lastShowcaseDelivery {
                    result = prior
                    phase = .done
                }
            }
        }
    }

    private var notSignedInView: some View {
        ContentUnavailableView(
            "Sign in to CreatorHub",
            systemImage: "person.crop.circle.badge.exclamationmark",
            description: Text("Delivering picks creates a CreatorHub gallery the client can view. Sign in via Settings → CreatorHub account.")
        )
    }

    private var configureView: some View {
        Form {
            Section("Which photos") {
                Picker("Filter", selection: $filter) {
                    Text("Picks (flag)").tag(BackendDeliverFilter.flagged)
                    Text("4★ and up").tag(BackendDeliverFilter.ratingAtLeast4)
                    Text("Picks + 4★").tag(BackendDeliverFilter.picksOr4Plus)
                    Text("All non-rejected").tag(BackendDeliverFilter.allNonRejected)
                }
                .pickerStyle(.segmented)
                let count = model.deliverablePicks(filter: localFilter(for: filter)).count
                Text(count == 1 ? "1 photo will be uploaded" : "\(count) photos will be uploaded")
                    .font(.footnote)
                    .foregroundStyle(.secondary)
            }
            Section("Client") {
                TextField("Client name", text: $clientName)
                    .textInputAutocapitalization(.words)
                TextField("Client email", text: $clientEmail)
                    .keyboardType(.emailAddress)
                    .textInputAutocapitalization(.never)
                    .autocorrectionDisabled()
            }
            Section("Project (optional)") {
                TextField("Project title — defaults to session name", text: $projectTitle)
            }
            if let errorMessage {
                Section {
                    Label(errorMessage, systemImage: "exclamationmark.triangle.fill")
                        .font(.footnote)
                        .foregroundStyle(.red)
                }
            }
            Section {
                Button {
                    Task { await runDelivery() }
                } label: {
                    Label("Deliver to CreatorHub", systemImage: "paperplane.fill")
                        .frame(maxWidth: .infinity)
                }
                .buttonStyle(.borderedProminent)
                .disabled(
                    model.deliverablePicks(filter: localFilter(for: filter)).isEmpty
                    || clientName.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
                    || !clientEmail.contains("@")
                )
                Text("Picks are uploaded to your CreatorHub account, then surfaced as a UniversalShowcase gallery the client can view at app.creatorhubn.com/client/gallery/…")
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }
        }
    }

    private func localFilter(for filter: BackendDeliverFilter) -> LiveCaptureModel.PickFilter {
        switch filter {
        case .flagged:        return .flagged
        case .ratingAtLeast4: return .fourPlus
        case .picksOr4Plus:   return .picksAndFourPlus
        case .allNonRejected: return .all
        }
    }

    private var workingView: some View {
        VStack(spacing: 18) {
            ProgressView()
                .controlSize(.large)
            Text("Uploading picks to CreatorHub…")
                .font(.headline)
            Text("Mirroring session, uploading previews to R2, creating UniversalShowcase gallery. Keep the iPad on this screen.")
                .font(.footnote)
                .foregroundStyle(.secondary)
                .multilineTextAlignment(.center)
                .padding(.horizontal, 24)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    }

    private var doneView: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 20) {
                if let result {
                    Label("Gallery ready", systemImage: "checkmark.seal.fill")
                        .font(.title3.weight(.semibold))
                        .foregroundStyle(.green)
                    let urlString = result.response.shareUrl
                    let url = URL(string: urlString) ?? URL(string: "https://app.creatorhubn.com")!

                    VStack(alignment: .leading, spacing: 6) {
                        Text("Client gallery URL").font(.caption.weight(.semibold)).foregroundStyle(.secondary)
                        Text(urlString)
                            .font(.callout.monospaced())
                            .lineLimit(3)
                            .padding(12)
                            .frame(maxWidth: .infinity, alignment: .leading)
                            .background(Color.captureChipBG, in: RoundedRectangle(cornerRadius: 8))
                            .textSelection(.enabled)
                    }

                    HStack(spacing: 12) {
                        Label("\(result.uploadedCount) uploaded", systemImage: "icloud.and.arrow.up")
                            .font(.footnote)
                            .foregroundStyle(.secondary)
                        Label(result.response.reusedExisting ? "Reused gallery" : "New gallery",
                              systemImage: result.response.reusedExisting ? "arrow.triangle.2.circlepath" : "sparkles")
                            .font(.footnote)
                            .foregroundStyle(.secondary)
                        Label("\(result.response.uploadedImageCount) added",
                              systemImage: "photo.stack")
                            .font(.footnote)
                            .foregroundStyle(.secondary)
                    }

                    HStack(spacing: 12) {
                        Button {
                            UIPasteboard.general.string = urlString
                        } label: {
                            Label("Copy URL", systemImage: "doc.on.doc")
                                .frame(maxWidth: .infinity)
                        }
                        .buttonStyle(.bordered)

                        Button {
                            showShareSheet = true
                        } label: {
                            Label("Share", systemImage: "square.and.arrow.up")
                                .frame(maxWidth: .infinity)
                        }
                        .buttonStyle(.borderedProminent)
                    }
                    .padding(.top, 8)

                    Text("This gallery now lives in your CreatorHub UniversalShowcase — manage it from the web dashboard like any other delivery.")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                        .padding(.top, 4)
                }
            }
            .padding(24)
        }
        .sheet(isPresented: $showShareSheet) {
            if let result, let url = URL(string: result.response.shareUrl) {
                ShareSheet(items: [url])
            }
        }
    }

    private func runDelivery() async {
        errorMessage = nil
        phase = .working
        do {
            let r = try await model.deliverToShowcase(
                filter: filter,
                clientName: clientName.trimmingCharacters(in: .whitespacesAndNewlines),
                clientEmail: clientEmail.trimmingCharacters(in: .whitespacesAndNewlines),
                projectTitle: projectTitle.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
                    ? nil
                    : projectTitle.trimmingCharacters(in: .whitespacesAndNewlines),
            )
            result = r
            phase = .done
        } catch {
            errorMessage = error.localizedDescription
            phase = .configure
        }
    }
}

/// Thin `UIActivityViewController` wrapper so SwiftUI can present the
/// system share sheet for the URL.
private struct ShareSheet: UIViewControllerRepresentable {
    let items: [Any]
    func makeUIViewController(context: Context) -> UIActivityViewController {
        UIActivityViewController(activityItems: items, applicationActivities: nil)
    }
    func updateUIViewController(_ uiViewController: UIActivityViewController, context: Context) {}
}

// MARK: - Sessions archive sheet

/// Phase 2B: browse all local sessions (active + closed). Tap one to
/// open a session-detail view; close the active one with a tap.
/// Backend-mirrored sessions still live in the local DB so this is a
/// purely local view of "what shoots have I done" — no network call.
private struct SessionsArchiveSheet: View {
    @Bindable var model: LiveCaptureModel
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        NavigationStack {
            Group {
                if model.isLoadingArchive {
                    ProgressView().controlSize(.large)
                        .frame(maxWidth: .infinity, maxHeight: .infinity)
                } else if model.archivedSessions.isEmpty {
                    ContentUnavailableView(
                        "No sessions yet",
                        systemImage: "tray",
                        description: Text("Connect a camera and capture a few shots — sessions land here automatically.")
                    )
                } else {
                    List(model.archivedSessions, id: \.id) { session in
                        SessionRow(session: session)
                    }
                    .listStyle(.insetGrouped)
                }
            }
            .navigationTitle("Sessions")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button("Done") { dismiss() }
                }
                ToolbarItem(placement: .topBarLeading) {
                    Button {
                        Task { await model.closeCurrentSession(); await model.loadArchivedSessions() }
                    } label: {
                        Label("Close current", systemImage: "stop.circle")
                    }
                }
            }
            .task { await model.loadArchivedSessions() }
        }
    }
}

private struct SessionRow: View {
    let session: Session

    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            HStack {
                Text(session.name)
                    .font(.headline)
                Spacer()
                statusBadge
            }
            HStack(spacing: 12) {
                Label(formatDate(session.startsAt), systemImage: "calendar")
                if let endsAt = session.endsAt {
                    Label("ended \(formatRelative(endsAt))", systemImage: "clock")
                }
            }
            .font(.caption)
            .foregroundStyle(.secondary)
        }
        .padding(.vertical, 4)
    }

    private var statusBadge: some View {
        Text(session.status.rawValue.capitalized)
            .font(.caption.weight(.semibold))
            .padding(.horizontal, 10)
            .padding(.vertical, 4)
            .foregroundStyle(badgeColor)
            .background(badgeColor.opacity(0.18), in: Capsule())
            .overlay(Capsule().stroke(badgeColor.opacity(0.5), lineWidth: 0.5))
    }

    private var badgeColor: Color {
        switch session.status {
        case .active: return .green
        case .paused: return .orange
        case .closed: return .secondary
        }
    }

    private func formatDate(_ date: Date) -> String {
        let f = DateFormatter()
        f.dateStyle = .medium
        f.timeStyle = .short
        return f.string(from: date)
    }

    private func formatRelative(_ date: Date) -> String {
        let f = RelativeDateTimeFormatter()
        f.unitsStyle = .short
        return f.localizedString(for: date, relativeTo: Date())
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
