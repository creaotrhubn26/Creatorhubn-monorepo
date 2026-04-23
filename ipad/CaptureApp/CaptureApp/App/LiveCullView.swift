import SwiftUI

/// Live Cull — the iPad-unique verb that makes shoot-day culling
/// bearable. Photographer sweeps through each asset in capture-time
/// order and votes in 4 directions:
///
///   → right  hero    (rating 5 + flagged for client)
///   ← left   reject  (rating 0 + rejected)
///   ↑ up     keep    (rating 4)
///   ↓ down   weak    (rating 2)
///
/// The gesture model is a single DragGesture with live feedback:
/// as the card follows the finger, its background tints toward the
/// decision colour, and the direction label slides in from the
/// opposite edge. Release past the threshold commits the decision;
/// release before commits nothing and the card springs back.
///
/// Every commit writes locally + enqueues the backend PATCH via
/// ``CullStore``, so the photographer can cull offline through an
/// entire shoot and the sync worker drains the queue when the iPad
/// reconnects.
struct LiveCullView: View {
    let sessionId: UUID
    let ownerUserId: String

    @State private var queue: [Asset] = []
    @State private var decidedCount = 0
    @State private var totalCount = 0
    @State private var loadError: String?
    @State private var isBusy = false
    @State private var dragOffset: CGSize = .zero
    @State private var lastCommitted: CullDecision?
    @State private var teaserSheetOpen = false
    @State private var markupSheetAssetId: UUID?
    @State private var markupExistingCapture: MarkupCapture?

    private var markupStore: AssetMarkupStore? {
        guard let url = try? AppDatabase.defaultDiskURL(),
              let db = try? AppDatabase.openOnDisk(at: url),
              let sigDir = try? MarkupStorage.defaultDirectory()
        else { return nil }
        return AssetMarkupStore(
            database: db,
            outbox: Outbox(database: db),
            markupStorage: MarkupStorage(rootDirectory: sigDir),
        )
    }

    private var store: CullStore? {
        do {
            let url = try AppDatabase.defaultDiskURL()
            let db = try AppDatabase.openOnDisk(at: url)
            return CullStore(database: db, outbox: Outbox(database: db))
        } catch {
            return nil
        }
    }

    private let commitThreshold: CGFloat = 120

    var body: some View {
        VStack(spacing: 0) {
            header
            Divider()
            Group {
                if let error = loadError {
                    errorView(error)
                } else if let current = queue.first {
                    cullCard(current)
                } else {
                    doneView
                }
            }
            .frame(maxWidth: .infinity, maxHeight: .infinity)
        }
        .navigationTitle("Live Cull")
        .navigationBarTitleDisplayMode(.inline)
        .sheet(
            isPresented: Binding(
                get: { markupSheetAssetId != nil },
                set: { if !$0 { markupSheetAssetId = nil } },
            ),
        ) {
            if let assetId = markupSheetAssetId,
               let asset = queue.first(where: { $0.id == assetId }) {
                MarkupCanvasView(
                    previewImage: nil,          // signed URL support kommer i sync-wiring
                    title: asset.originalFilename,
                    existingMarkup: markupExistingCapture,
                    onFinish: { capture in
                        Task { await commitMarkup(capture, forAsset: assetId) }
                    },
                )
            }
        }
        .task { await reload() }
    }

    // MARK: - Markup flow

    private func openMarkupSheet(for asset: Asset) async {
        // Preload any existing markup so the canvas rehydrates.
        if let store = markupStore {
            markupExistingCapture = try? await store.load(
                assetId: asset.id,
                ownerUserId: ownerUserId,
            )
        }
        markupSheetAssetId = asset.id
    }

    private func commitMarkup(_ capture: MarkupCapture?, forAsset assetId: UUID) async {
        guard let capture, !capture.isEmpty else {
            markupSheetAssetId = nil
            return
        }
        guard let store = markupStore else { return }
        do {
            _ = try await store.save(
                assetId: assetId,
                ownerUserId: ownerUserId,
                capture: capture,
            )
        } catch {
            loadError = "Kunne ikke lagre markup: \(error)"
        }
        markupSheetAssetId = nil
    }

    // MARK: - Header progress

    private var header: some View {
        HStack {
            Text("\(decidedCount) / \(totalCount) vurdert")
                .font(.subheadline.monospacedDigit())
                .foregroundStyle(.secondary)
            Spacer()
            if let last = lastCommitted {
                Label(lastLabel(last), systemImage: lastIcon(last))
                    .font(.caption)
                    .foregroundStyle(colorFor(last))
                    .transition(.opacity)
            }
        }
        .padding(.horizontal, 16)
        .padding(.vertical, 8)
    }

    // MARK: - Card

    private func cullCard(_ asset: Asset) -> some View {
        GeometryReader { proxy in
            let size = proxy.size
            let threshold = commitThreshold
            let direction = dominantDirection(of: dragOffset, threshold: threshold)

            ZStack {
                // Underlay indicates the decision colour that would
                // commit on release — a visual pre-commit affordance.
                if let d = direction {
                    colorFor(d).opacity(
                        min(0.35, max(abs(dragOffset.width), abs(dragOffset.height)) / (threshold * 2))
                    )
                }

                // The actual asset card. Placeholder for the preview
                // until the sync engine gives us signed URLs (task
                // #47). Shows the filename + capture time so the
                // photographer knows which shot they're voting on
                // even without the image.
                VStack(spacing: 12) {
                    Image(systemName: "photo")
                        .font(.system(size: 120))
                        .foregroundStyle(.tertiary)
                    Text(asset.originalFilename)
                        .font(.headline)
                    Text(asset.captureTime.formatted(date: .omitted, time: .shortened))
                        .font(.subheadline)
                        .foregroundStyle(.secondary)
                    if let sharpness = asset.signals.sharpness {
                        Text("Sharpness: \(Int(sharpness))")
                            .font(.caption)
                            .foregroundStyle(.tertiary)
                    }
                }
                .padding(24)
                .frame(width: size.width * 0.9, height: size.height * 0.9)
                .background(
                    RoundedRectangle(cornerRadius: 20)
                        .fill(Color(uiColor: .secondarySystemBackground))
                        .shadow(color: .black.opacity(0.12), radius: 10, y: 4)
                )
                .overlay(alignment: .topTrailing) {
                    if let d = direction {
                        decisionBadge(d)
                            .padding(16)
                    }
                }
                .offset(dragOffset)
                .rotationEffect(.degrees(Double(dragOffset.width) / 20))
                .gesture(
                    DragGesture()
                        .onChanged { value in
                            dragOffset = value.translation
                        }
                        .onEnded { value in
                            Task { await finishDrag(value.translation, assetId: asset.id) }
                        },
                )
                // Double-tap opens the Pencil markup sheet. Single
                // tap is reserved for the swipe-gesture commit path,
                // and separating the two gestures cleanly via
                // ``simultaneousGesture`` with a double-tap counter
                // avoids the markup sheet firing during quick
                // culling sessions.
                .onTapGesture(count: 2) {
                    Task { await openMarkupSheet(for: asset) }
                }

                // 4-direction hint overlay — shown only when the
                // card is at rest. Helps first-time users remember
                // the gesture map without a tutorial.
                if dragOffset == .zero {
                    swipeLegend
                        .frame(maxWidth: .infinity, maxHeight: .infinity)
                        .allowsHitTesting(false)
                }
            }
            .frame(width: size.width, height: size.height)
        }
    }

    private func decisionBadge(_ decision: CullDecision) -> some View {
        Text(labelFor(decision).uppercased())
            .font(.headline.bold())
            .padding(.horizontal, 12)
            .padding(.vertical, 6)
            .background(colorFor(decision).opacity(0.2))
            .foregroundStyle(colorFor(decision))
            .clipShape(Capsule())
    }

    private var swipeLegend: some View {
        ZStack {
            VStack {
                Text("↑ Behold")
                    .foregroundStyle(.blue)
                    .padding(.top, 8)
                Spacer()
                Text("↓ Svak")
                    .foregroundStyle(.orange)
                    .padding(.bottom, 8)
            }
            HStack {
                Text("← Avvis")
                    .foregroundStyle(.red)
                    .padding(.leading, 8)
                Spacer()
                Text("Hero →")
                    .foregroundStyle(.green)
                    .padding(.trailing, 8)
            }
        }
        .font(.caption.weight(.semibold))
        .opacity(0.55)
    }

    // MARK: - Done + error

    private var doneView: some View {
        VStack(spacing: 16) {
            Image(systemName: "checkmark.seal.fill")
                .font(.system(size: 64))
                .foregroundStyle(.green)
            Text("Ferdig!")
                .font(.title.bold())
            Text("Alle \(totalCount) bilder er vurdert.")
                .font(.subheadline)
                .foregroundStyle(.secondary)
            // Kvikk-teaser er det neste naturlige steget: du har
            // akkurat flagget hero-frames, klienten venter. Én tap
            // her sender dem galleri-URLen uten å forlate iPaden.
            Button {
                teaserSheetOpen = true
            } label: {
                Label("Send teaser til klient", systemImage: "paperplane.fill")
            }
            .buttonStyle(.borderedProminent)

            Button("Last inn på nytt") {
                Task { await reload() }
            }
            .buttonStyle(.bordered)
        }
        .sheet(isPresented: $teaserSheetOpen) {
            QuickTeaserView(
                sessionId: sessionId,
                ownerUserId: ownerUserId,
            )
        }
    }

    private func errorView(_ error: String) -> some View {
        VStack(spacing: 12) {
            Label("Kunne ikke laste assets", systemImage: "exclamationmark.triangle.fill")
                .foregroundStyle(.red)
            Text(error)
                .font(.caption)
                .foregroundStyle(.secondary)
        }
        .padding()
    }

    // MARK: - Actions

    private func reload() async {
        guard let store else {
            loadError = "Database ikke tilgjengelig"
            return
        }
        do {
            queue = try await store.assets(
                sessionId: sessionId,
                ownerUserId: ownerUserId,
                undecidedOnly: true,
            )
            totalCount = try await store.totalAssets(
                sessionId: sessionId,
                ownerUserId: ownerUserId,
            )
            decidedCount = try await store.decidedAssets(
                sessionId: sessionId,
                ownerUserId: ownerUserId,
            )
            loadError = nil
        } catch {
            loadError = String(describing: error)
        }
    }

    private func finishDrag(_ translation: CGSize, assetId: UUID) async {
        guard let direction = dominantDirection(of: translation,
                                                threshold: commitThreshold) else {
            withAnimation(.spring()) { dragOffset = .zero }
            return
        }

        // Snap the card off-screen in the direction of commit, then
        // pop it from the queue. Haptic feedback for tactile
        // confirmation — photographers rely on this more than visual
        // cues during fast culling.
        await commit(direction, for: assetId)
    }

    private func commit(_ decision: CullDecision, for assetId: UUID) async {
        guard let store else { return }
        UIImpactFeedbackGenerator(style: .medium).impactOccurred()
        withAnimation(.easeOut(duration: 0.25)) {
            dragOffset = offScreen(for: decision)
        }
        do {
            _ = try await store.apply(
                decision,
                to: assetId,
                ownerUserId: ownerUserId,
            )
            lastCommitted = decision
            // Pop the card and reset the gesture for the next asset.
            queue.removeFirst()
            decidedCount += 1
            try? await Task.sleep(for: .milliseconds(180))
            dragOffset = .zero
        } catch {
            loadError = String(describing: error)
            withAnimation(.spring()) { dragOffset = .zero }
        }
    }

    /// Which direction, if any, the current drag is pushing hardest
    /// in. Returns nil below the commit threshold.
    private func dominantDirection(
        of translation: CGSize,
        threshold: CGFloat,
    ) -> CullDecision? {
        let dx = translation.width
        let dy = translation.height
        if abs(dx) < threshold && abs(dy) < threshold { return nil }
        return abs(dx) > abs(dy)
            ? (dx > 0 ? .hero : .reject)
            : (dy > 0 ? .weak : .keep)
    }

    private func offScreen(for decision: CullDecision) -> CGSize {
        switch decision {
        case .hero:   return CGSize(width: 1000, height: 0)
        case .reject: return CGSize(width: -1000, height: 0)
        case .keep:   return CGSize(width: 0, height: -1000)
        case .weak:   return CGSize(width: 0, height: 1000)
        }
    }

    // MARK: - Styling helpers

    private func colorFor(_ decision: CullDecision) -> Color {
        switch decision {
        case .hero:   return .green
        case .keep:   return .blue
        case .weak:   return .orange
        case .reject: return .red
        }
    }

    private func labelFor(_ decision: CullDecision) -> String {
        switch decision {
        case .hero:   return "hero"
        case .keep:   return "behold"
        case .weak:   return "svak"
        case .reject: return "avvis"
        }
    }

    private func lastIcon(_ decision: CullDecision) -> String {
        switch decision {
        case .hero:   return "star.fill"
        case .keep:   return "checkmark"
        case .weak:   return "questionmark.circle"
        case .reject: return "trash"
        }
    }

    private func lastLabel(_ decision: CullDecision) -> String {
        "siste: \(labelFor(decision))"
    }
}
