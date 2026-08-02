import SwiftUI
import CoreImage
import OutboxKit

// MARK: - View

struct RedigeringView: View {
    @State private var model = RedigeringModel()
    @State private var zoom: CGFloat = 1
    @State private var showCrop = false
    @State private var showMask = false
    /// Kvalitetssjekk-review (steg 4) — flagg leveranse-blokkere over serien.
    @State private var showQualityReview = false
    /// Bilde-først: skjul inspector-panelet så bildet fyller bredden.
    @State private var inspectorOpen = true
    /// Histogram + clipping-varsel-overlegg på sammenlignings-bildet.
    @State private var showHistogram = false
    /// Vis motiv-maske-overlegg (hva AI segmenterer/behandler lokalt).
    @State private var showMaskOverlay = ProcessInfo.processInfo.arguments.contains("--mask-on")
    @State private var maskOverlay: UIImage?
    /// Vis «AI-endringer»-heatmap (hvor + hvor mye redigeringen endret bildet).
    @State private var showDiff = ProcessInfo.processInfo.arguments.contains("--diff-on")
    @State private var diffOverlay: UIImage?

    var body: some View {
        NavigationStack {
            Group {
                if model.loading {
                    ProgressView("Laster bilder…").frame(maxWidth: .infinity, maxHeight: .infinity)
                } else if model.assets.isEmpty {
                    ContentUnavailableView("Ingen bilder å redigere", systemImage: "wand.and.stars",
                                           description: Text("Velg en fotoøkt med importerte bilder."))
                } else {
                    content
                }
            }
            .frame(maxWidth: .infinity, maxHeight: .infinity)
            .background(CHTheme.bg.ignoresSafeArea())
            .navigationTitle("Redigering")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    HStack(spacing: 14) {
                        Button {
                            model.localFaceMode.toggle()
                            if model.localFaceMode { model.detectFacesForLocal() }
                        } label: {
                            Image(systemName: "person.crop.circle.badge.checkmark")
                                .foregroundStyle(model.localFaceMode ? CHTheme.accent : CHTheme.textSecondary)
                        }
                        .help("Trykk-på-ansikt (lokal justering)")
                        Button {
                            showMaskOverlay.toggle()
                            Task { await updateMaskOverlay() }
                        } label: {
                            Image(systemName: "person.crop.rectangle.stack")
                                .foregroundStyle(showMaskOverlay ? CHTheme.accent : CHTheme.textSecondary)
                        }
                        .help("Vis motiv-maske (per-region)")
                        Button {
                            showDiff.toggle()
                            Task { await updateDiffOverlay() }
                        } label: {
                            Image(systemName: "square.on.square.dashed")
                                .foregroundStyle(showDiff ? CHTheme.accent : CHTheme.textSecondary)
                        }
                        .help("Vis AI-endringer (heatmap)")
                        Button {
                            showHistogram.toggle()
                        } label: {
                            Image(systemName: "waveform.path.ecg.rectangle")
                                .foregroundStyle(showHistogram ? CHTheme.accent : CHTheme.textSecondary)
                        }
                        .help("Histogram + clipping")
                        Button {
                            withAnimation(.easeInOut(duration: 0.22)) { inspectorOpen.toggle() }
                        } label: {
                            Image(systemName: inspectorOpen ? "sidebar.right" : "slider.horizontal.3")
                                .foregroundStyle(inspectorOpen ? CHTheme.textSecondary : CHTheme.accent)
                        }
                        .help(inspectorOpen ? "Skjul panel (større bilde)" : "Vis verktøy-panel")
                        sessionMenu
                    }
                }
            }
        }
        .task { await model.loadSessions() }
        .sheet(isPresented: $showCrop) {
            if let path = model.selected?.previewKey ?? model.selected?.displayPreviewKey {
                RectMarqueeSheet(imagePath: path, title: "Beskjær", applyLabel: "Beskjær",
                                 initialRect: model.currentCrop, allowReset: true,
                                 onReset: { model.setCrop(nil) }) { rect in model.setCrop(rect) }
            }
        }
        .sheet(isPresented: $showMask) {
            if let path = model.selected?.displayPreviewKey {
                RectMarqueeSheet(imagePath: path, title: "Masker — marker for fjerning", applyLabel: "Fjern område",
                                 initialRect: nil, allowReset: false, onReset: {}) { rect in
                    Task { await model.runManualInpaint(normalizedRect: rect) }
                }
            }
        }
        .sheet(isPresented: $showQualityReview) {
            QualityReviewSheet(model: model)
        }
        .chBranded()
    }

    private var sessionMenu: some View {
        Menu {
            ForEach(model.sessions) { s in
                Button(s.name) { Task { await model.pick(s) } }
            }
        } label: {
            Label(model.session?.name ?? "Økt", systemImage: "chevron.down").labelStyle(.titleAndIcon)
        }
        .tint(CHTheme.accent)
    }

    private var content: some View {
        GeometryReader { geo in
            // Bildet dominerer: ~70 % av høyden med inspector åpen, ~82 % lukket.
            let imageH = geo.size.height * (inspectorOpen ? 0.70 : 0.82)
            VStack(alignment: .leading, spacing: 12) {
                subtitle
                HStack(alignment: .top, spacing: 14) {
                    VStack(spacing: 10) {
                        compareCard(height: imageH)
                        if model.localFaceMode, let fi = model.activeFace { localFaceControl(fi) }
                        toolbarRow
                    }
                    .frame(maxWidth: .infinity)
                    if inspectorOpen {
                        ScrollView { SmartEditPanel(model: model) }
                            .frame(width: 340)
                            .transition(.move(edge: .trailing).combined(with: .opacity))
                    }
                }
                // Sekundært (prosjekt/status) — komprimert nederst, ikke i veien.
                ScrollView(.vertical, showsIndicators: false) {
                    VStack(alignment: .leading, spacing: 12) {
                        queueStrip
                        StepFlow(qualityDone: model.qualityDidRun) { showQualityReview = true }
                        bottomCards
                    }
                }
                .frame(maxHeight: geo.size.height * 0.22)
            }
            .padding(16)
        }
    }

    private var subtitle: some View {
        HStack(spacing: 6) {
            Circle().fill(CHTheme.accent).frame(width: 7, height: 7)
            Text("\(model.assets.count) bilder importert · AI-analyse ferdig")
                .font(.subheadline).foregroundStyle(CHTheme.textSecondary)
        }
    }

    private func compareCard(height: CGFloat) -> some View {
        BeforeAfterCompare(
            beforePath: model.selected?.previewKey ?? model.selected?.displayPreviewKey,
            after: model.afterImage,
            rendering: model.rendering,
            zoom: $zoom,
            showHistogram: showHistogram,
            maskOverlay: showMaskOverlay ? maskOverlay : nil,
            diffOverlay: showDiff ? diffOverlay : nil,
            faceDots: model.localFaceMode ? model.faceRectsNorm : [],
            activeFace: model.activeFace,
            onTapFace: { model.activeFace = $0 },
        )
        .frame(height: max(320, height))
        .clipShape(RoundedRectangle(cornerRadius: 16))
        .overlay(alignment: .bottomLeading) { exifBadge }
        .overlay(alignment: .top) { degradedBaseWarning }
        .onChange(of: model.afterImage) { _, _ in
            Task { await updateMaskOverlay(); await updateDiffOverlay() }
            if model.localFaceMode { model.detectFacesForLocal() }
        }
    }

    /// #4: advar når redigering + eksport nå skjer fra en ~2400px preview-JPEG
    /// (etter AI-retusj) i stedet for kamera-RAW — et kvalitetstap ellers usett.
    @ViewBuilder private var degradedBaseWarning: some View {
        if model.baseIsDegraded {
            HStack(spacing: 6) {
                Image(systemName: "exclamationmark.triangle.fill").font(.caption2)
                Text("Videre redigering skjer fra ~2400px-preview (ikke RAW) etter AI-retusj")
                    .font(.caption2)
            }
            .foregroundStyle(.white)
            .padding(.horizontal, 10).padding(.vertical, 6)
            .background(.orange.opacity(0.9), in: Capsule())
            .padding(8)
        }
    }

    /// Opptaksdata-merke (kamera-EXIF): ISO/blender/lukker/brennvidde + kamera/
    /// objektiv, lest fra RAW/JPEG. Diskret nederst-venstre i compare-kortet.
    @ViewBuilder private var exifBadge: some View {
        if let exif = model.exif, exif.hasData {
            VStack(alignment: .leading, spacing: 1) {
                if !exif.techLine.isEmpty {
                    Text(exif.techLine)
                        .font(.caption2.weight(.semibold)).foregroundStyle(.white)
                }
                if let cam = exif.camera {
                    Text(exif.lens.map { "\(cam) · \($0)" } ?? cam)
                        .font(.system(size: 9)).foregroundStyle(.white.opacity(0.75))
                }
            }
            .padding(.horizontal, 8).padding(.vertical, 5)
            .background(.black.opacity(0.45), in: RoundedRectangle(cornerRadius: 8))
            .padding(10)
        }
    }

    /// Beregn «AI-endringer»-heatmap fra Før (preview) vs Etter (off-main).
    private func updateDiffOverlay() async {
        guard showDiff, let after = model.afterImage,
              let path = model.selected?.previewKey ?? model.selected?.displayPreviewKey,
              let before = UIImage(contentsOfFile: path) else { diffOverlay = nil; return }
        diffOverlay = await Task.detached(priority: .userInitiated) {
            DiffHeatmap.overlay(before: before, after: after)
        }.value
    }

    /// Lokal justerings-kontroll for det tappede ansiktet (lys + varme, maskert).
    private func localFaceControl(_ i: Int) -> some View {
        let adj = model.faceAdjust[i] ?? .init()
        return HStack(spacing: 14) {
            Text("Ansikt \(i + 1)").font(.caption.weight(.bold)).foregroundStyle(CHTheme.accent)
            faceSlider("Lys", systemImage: "sun.max", value: adj.brightness) { v in
                var a = adj; a.brightness = v; model.setFaceAdjust(a, for: i)
            }
            faceSlider("Varme", systemImage: "thermometer.medium", value: adj.warmth) { v in
                var a = adj; a.warmth = v; model.setFaceAdjust(a, for: i)
            }
            Button {
                model.setFaceAdjust(.init(), for: i)
            } label: { Image(systemName: "arrow.counterclockwise").font(.caption) }
                .buttonStyle(.plain).foregroundStyle(CHTheme.textMuted)
        }
        .padding(.horizontal, 12).padding(.vertical, 8)
        .background(CHTheme.surface, in: RoundedRectangle(cornerRadius: 12))
    }

    private func faceSlider(_ title: String, systemImage: String, value: Double, onChange: @escaping (Double) -> Void) -> some View {
        VStack(alignment: .leading, spacing: 1) {
            Label("\(title)  \(String(format: "%+.0f", value * 100))", systemImage: systemImage)
                .font(.caption2).foregroundStyle(CHTheme.textSecondary)
            Slider(value: Binding(get: { value }, set: onChange), in: -1...1)
                .tint(CHTheme.accent).frame(width: 150)
        }
    }

    /// Beregn motiv-maske-overlegget fra «Etter»-bildet (Vision, off-main).
    private func updateMaskOverlay() async {
        guard showMaskOverlay, let after = model.afterImage, let cg = after.cgImage else {
            maskOverlay = nil; return
        }
        maskOverlay = await Task.detached(priority: .userInitiated) {
            SubjectSegmentation.subjectOverlay(
                for: cg, extent: CGRect(x: 0, y: 0, width: cg.width, height: cg.height))
        }.value
    }

    private var toolbarRow: some View {
        HStack(spacing: 0) {
            toolButton("Zoom", "plus.magnifyingglass", active: zoom > 1) { withAnimation { zoom = zoom > 1 ? 1 : 2 } }
            toolButton("Beskjær", "crop", active: model.currentCrop != nil) { showCrop = true }
            toolButton("Sammenlign", "rectangle.split.2x1", active: true) {}
            toolButton("Masker", "paintbrush.pointed") { showMask = true }
            toolButton("Angre", "arrow.uturn.backward", enabled: model.canUndo) { model.undoEdit() }
            toolButton("Gjør om", "arrow.uturn.forward", enabled: model.canRedo) { model.redoEdit() }
        }
        .padding(.vertical, 8)
        .background(CHTheme.surface, in: RoundedRectangle(cornerRadius: 12))
    }

    private func toolButton(_ title: String, _ icon: String, active: Bool = false, enabled: Bool = true, _ action: @escaping () -> Void) -> some View {
        Button(action: action) {
            VStack(spacing: 4) {
                Image(systemName: icon)
                Text(title).font(.caption2)
            }
            .frame(maxWidth: .infinity)
            .foregroundStyle(active ? CHTheme.accent : (enabled ? CHTheme.textSecondary : CHTheme.textMuted))
        }
        .disabled(!enabled)
    }

    private var queueStrip: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack {
                Label("Bildkø (\(model.assets.count))", systemImage: "rectangle.stack")
                    .font(.subheadline.weight(.semibold)).foregroundStyle(CHTheme.textPrimary)
                Spacer()
                Text("Sortér: Opptaksrekkefølge").font(.caption).foregroundStyle(CHTheme.textMuted)
            }
            ScrollView(.horizontal, showsIndicators: false) {
                HStack(spacing: 8) {
                    ForEach(model.assets) { a in
                        QueueThumb(asset: a, selected: a.id == model.selectedId) { model.select(a) }
                    }
                }
            }
        }
        .padding(14)
        .background(CHTheme.surface, in: RoundedRectangle(cornerRadius: 14))
    }

    private var bottomCards: some View {
        HStack(alignment: .top, spacing: 12) {
            batchCard; qualityCard; suggestionsCard; deliveryCard
        }
    }

    /// Kvalitetssjekk-kort (steg 4) — kjør passet og se antall flaggede; trykk
    /// for full review-liste (hopp til hvert problembilde).
    private var qualityCard: some View {
        InfoCard(title: "Kvalitetssjekk", icon: "checkmark.seal") {
            if model.qualityRunning {
                row("hourglass", "Analyserer \(model.qualityProgress)/\(model.qualityTotal)…", CHTheme.accent)
                ProgressView(value: Double(model.qualityProgress), total: Double(max(1, model.qualityTotal)))
                    .tint(CHTheme.accent)
            } else if model.qualityDidRun {
                if model.qualityFindings.isEmpty {
                    row("checkmark.circle.fill", "Ingen blokkere", CHTheme.success)
                } else {
                    if model.qualityBlockerCount > 0 {
                        row("exclamationmark.triangle.fill", "\(model.qualityBlockerCount) blokkere", Color(hex: 0xE0606A))
                    }
                    if model.qualityWarningCount > 0 {
                        row("eye.trianglebadge.exclamationmark", "\(model.qualityWarningCount) svake", .orange)
                    }
                }
                Button { showQualityReview = true } label: {
                    Label("Se gjennomgang", systemImage: "list.bullet.rectangle")
                        .font(.caption.weight(.semibold))
                }
                .buttonStyle(.bordered).controlSize(.small).tint(CHTheme.accent)
            } else {
                row("sparkle.magnifyingglass", "Lukkede øyne · fokus · motiv-klipp", CHTheme.textMuted)
                Button { showQualityReview = true } label: {
                    Label("Kjør kvalitetssjekk", systemImage: "checkmark.seal")
                        .font(.caption.weight(.semibold)).frame(maxWidth: .infinity)
                }
                .buttonStyle(.borderedProminent).controlSize(.small).tint(CHTheme.accent)
            }
        }
    }

    private var batchCard: some View {
        InfoCard(title: "Batch-redigering", icon: "rectangle.on.rectangle") {
            if model.seriesTotal > 0 {
                row("hourglass", "Lagrer \(model.seriesProgress)/\(model.seriesTotal)…", CHTheme.accent)
                ProgressView(value: Double(model.seriesProgress), total: Double(max(1, model.seriesTotal)))
                    .tint(CHTheme.accent)
            } else {
                row("checkmark.circle.fill", "\(model.appliedCount) bilder klare", CHTheme.success)
                row("clock", "\(max(0, model.assets.count - model.appliedCount)) i kø", CHTheme.textMuted)
                row("globe", "Levering: Web + Print", CHTheme.textSecondary)
                ProgressView(value: Double(model.appliedCount), total: Double(max(1, model.assets.count)))
                    .tint(CHTheme.accent)
                Text("\(model.appliedCount) / \(model.assets.count) bilder").font(.caption2).foregroundStyle(CHTheme.textMuted)
            }
        }
    }

    private var suggestionsCard: some View {
        InfoCard(title: "AI forslag", icon: "lightbulb") {
            let items = model.editSuggestions
            if items.isEmpty {
                HStack(spacing: 8) {
                    Image(systemName: "checkmark.seal").foregroundStyle(CHTheme.success)
                    Text("Ingen justeringer foreslått").font(.caption).foregroundStyle(CHTheme.textSecondary)
                }
            } else {
                // Data-drevet: hvert forslag leser AssetAnalysis for det valgte
                // bildet og bærer en ETT-KLIKKS recipe-delta.
                ForEach(items) { s in
                    Button { model.applySuggestion(s) } label: {
                        HStack(spacing: 8) {
                            Image(systemName: s.icon).foregroundStyle(CHTheme.accent).frame(width: 18)
                            VStack(alignment: .leading, spacing: 1) {
                                Text(s.title).font(.caption.weight(.semibold)).foregroundStyle(CHTheme.textPrimary)
                                Text(s.detail).font(.caption2).foregroundStyle(CHTheme.textMuted)
                            }
                            Spacer()
                            Image(systemName: "plus.circle").font(.caption).foregroundStyle(CHTheme.accent)
                        }
                    }
                    .buttonStyle(.plain)
                }
            }
        }
    }

    private var deliveryCard: some View {
        InfoCard(title: "Levering", icon: "shippingbox") {
            HStack {
                VStack(alignment: .leading) {
                    Text("Neste levering").font(.caption).foregroundStyle(CHTheme.textMuted)
                    Text("18:00").font(.title2.weight(.bold)).foregroundStyle(CHTheme.textPrimary)
                }
                Spacer()
                Image(systemName: "clock").foregroundStyle(CHTheme.textMuted)
            }
            Text("Klientgalleri klargjøres").font(.caption).foregroundStyle(CHTheme.textMuted)
            ProgressView(value: 0.7).tint(CHTheme.accent)
        }
    }

    private func row(_ icon: String, _ text: String, _ tint: Color) -> some View {
        Label(text, systemImage: icon).font(.caption).foregroundStyle(tint)
    }
}

// MARK: - Histogram + clipping

/// Kompakt luma-histogram + clipping-varsel (utblåste høylys / knuste skygger)
/// beregnet fra «Etter»-bildet — proft vurderingsverktøy fotografen etterlyste.
struct HistogramOverlay: View {
    let image: UIImage
    @State private var bins: [Double] = []
    @State private var clipHi = 0.0
    @State private var clipLo = 0.0

    var body: some View {
        VStack(alignment: .leading, spacing: 4) {
            if clipHi > 0.005 || clipLo > 0.005 {
                HStack(spacing: 8) {
                    if clipHi > 0.005 {
                        Label("Høylys klippet \(Int(clipHi * 100))%", systemImage: "exclamationmark.triangle.fill")
                            .foregroundStyle(Color(hex: 0xE0606A))
                    }
                    if clipLo > 0.005 {
                        Label("Skygger klippet \(Int(clipLo * 100))%", systemImage: "exclamationmark.triangle.fill")
                            .foregroundStyle(Color(hex: 0x4A90E2))
                    }
                }
                .font(.caption2.weight(.semibold))
            }
            GeometryReader { geo in
                let maxV = max(bins.max() ?? 1, 0.0001)
                HStack(alignment: .bottom, spacing: 1) {
                    ForEach(bins.indices, id: \.self) { i in
                        Rectangle().fill(.white.opacity(0.75))
                            .frame(height: geo.size.height * CGFloat(bins[i] / maxV))
                    }
                }
                .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .bottom)
            }
            .frame(width: 220, height: 56)
            .padding(6)
            .background(.black.opacity(0.5), in: RoundedRectangle(cornerRadius: 8))
        }
        .task(id: image) { compute() }
    }

    private func compute() {
        guard let cg = image.cgImage else { return }
        let w = 96, h = 96
        var px = [UInt8](repeating: 0, count: w * h * 4)
        guard let ctx = CGContext(data: &px, width: w, height: h, bitsPerComponent: 8, bytesPerRow: w * 4,
                                  space: CGColorSpaceCreateDeviceRGB(),
                                  bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue) else { return }
        ctx.draw(cg, in: CGRect(x: 0, y: 0, width: w, height: h))
        var b = [Double](repeating: 0, count: 48)
        var hi = 0.0, lo = 0.0
        let n = Double(w * h)
        for i in stride(from: 0, to: px.count, by: 4) {
            let l = 0.299 * Double(px[i]) + 0.587 * Double(px[i + 1]) + 0.114 * Double(px[i + 2])
            b[min(47, Int(l / 256.0 * 48))] += 1
            if l >= 252 { hi += 1 }
            if l <= 3 { lo += 1 }
        }
        bins = b.map { $0 / n }
        clipHi = hi / n
        clipLo = lo / n
    }
}
