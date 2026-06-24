import SwiftUI

/// "AI-forbedring (sky)" — the full server-side photo-enhancer brought native:
/// face restoration, upscale, denoise, retouch, LUT, presets, AI recipe
/// suggestion, EXIF copyright on export, and feedback. Runs `POST /enhance`
/// (RAW supported via dcraw). Heavy AI models fall back to the server's local
/// "sharp" pipeline until the GPU runner is deployed.
@MainActor
@Observable
final class SkyEnhanceModel {
    let asset: Asset
    var preset = "portrait"
    var settings = EnhanceSettings()
    var copyright = ""
    var artist = ""
    var luts: [EnhancerLut] = []

    private(set) var beforeImage: UIImage?
    private(set) var resultImage: UIImage?
    private(set) var resultJPEG: Data?
    private(set) var modelInfo: String?
    var busy = false
    var statusMessage: String?
    private var suggested: EnhanceSettings?

    init(asset: Asset) {
        self.asset = asset
        if let p = asset.previewKey ?? asset.displayPreviewKey { beforeImage = UIImage(contentsOfFile: p) }
    }

    static let presets = ["auto", "portrait", "wedding", "landscape", "product", "studio"]
    static let models = ["auto", "sharp", "gfpgan", "codeformer", "realesrgan", "swinir", "bsrgan", "diffbir"]

    /// Source bytes for /enhance — prefer the camera RAW (best quality).
    private func sourceBytes() -> (data: Data, name: String, mime: String)? {
        if let raw = asset.rawKey, let d = try? Data(contentsOf: URL(fileURLWithPath: raw)) {
            return (d, asset.originalFilename, "image/x-canon-cr2")
        }
        if let p = asset.displayPreviewKey, let d = try? Data(contentsOf: URL(fileURLWithPath: p)) {
            return (d, "image.jpg", "image/jpeg")
        }
        return nil
    }

    private func previewBytes() -> Data? {
        guard let p = asset.displayPreviewKey ?? asset.previewKey else { return nil }
        return try? Data(contentsOf: URL(fileURLWithPath: p))
    }

    func loadLuts() async {
        guard let client = PhotoEnhancerClient.make() else { return }
        luts = (try? await client.listLuts(owner: SignInService.shared.session?.userId)) ?? []
    }

    func suggest() async {
        guard let client = PhotoEnhancerClient.make(), let preview = previewBytes() else { return }
        busy = true; statusMessage = "Henter AI-forslag…"; defer { busy = false }
        do {
            let recipe = try await client.suggestRecipe(imageData: preview, mime: "image/jpeg", preset: preset, instruction: nil)
            suggested = recipe
            settings = recipe
            statusMessage = "AI-forslag lastet inn."
        } catch { statusMessage = (error as? PhotoEnhancerClient.EnhancerError)?.errorDescription ?? "Forslag feilet." }
    }

    private var runTask: Task<Void, Never>?

    func run() {
        guard let client = PhotoEnhancerClient.make(), let src = sourceBytes() else { return }
        busy = true; statusMessage = "Starter…"
        runTask = Task { @MainActor in
            defer { busy = false }
            do {
                // Async: upload to B2 → queue → poll → result. Non-blocking,
                // progress-reported, cancelable. Source stays on B2 (no R2).
                let r = try await client.enhanceAsync(
                    imageData: src.data, fileName: src.name, mime: src.mime,
                    preset: preset, settings: settings, projectId: "photo-enhancer",
                ) { [weak self] _, msg in self?.statusMessage = msg }
                resultImage = r.image; resultJPEG = r.jpegData
                modelInfo = "Modell: \(r.modelUsed ?? "?") · async (B2-kø)"
                statusMessage = "Ferdig."
            } catch is CancellationError {
                statusMessage = "Avbrutt."
            } catch {
                statusMessage = (error as? PhotoEnhancerClient.EnhancerError)?.errorDescription ?? "Forbedring feilet."
            }
        }
    }

    func cancelRun() { runTask?.cancel() }

    /// Persist the result as the asset's server-enhanced variant. Stamps EXIF
    /// copyright first when provided, then teaches the personalisation model.
    func apply(onDone: @escaping () -> Void) async {
        guard let client = PhotoEnhancerClient.make(), var jpeg = resultJPEG else { return }
        busy = true; defer { busy = false }
        if !copyright.isEmpty || !artist.isEmpty {
            if let stamped = try? await client.stampMetadata(
                imageData: jpeg, mime: "image/jpeg", copyright: copyright, artist: artist, keywords: []) {
                jpeg = stamped
            }
        }
        let dir = FileManager.default.urls(for: .documentDirectory, in: .userDomainMask)[0]
            .appendingPathComponent("redigering", isDirectory: true)
        try? FileManager.default.createDirectory(at: dir, withIntermediateDirectories: true)
        let dest = dir.appendingPathComponent("\(asset.id.uuidString)-sky.jpg")
        guard (try? jpeg.write(to: dest, options: .atomic)) != nil else { statusMessage = "Kunne ikke lagre."; return }

        if let url = try? AppDatabase.defaultDiskURL(), let db = try? AppDatabase.openOnDisk(at: url) {
            try? await SessionStore(database: db).attachServerEnhancedKey(id: asset.id, key: dest.path)
        }
        if let suggested { await client.submitFeedback(suggested: suggested, final: settings) }
        statusMessage = "Lagret."
        onDone()
    }
}

struct SkyEnhanceView: View {
    @State private var model: SkyEnhanceModel
    @Environment(\.dismiss) private var dismiss
    let onApplied: () -> Void

    init(asset: Asset, onApplied: @escaping () -> Void) {
        _model = State(initialValue: SkyEnhanceModel(asset: asset))
        self.onApplied = onApplied
    }

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 16) {
                    comparePane
                    if let info = model.modelInfo {
                        Text(info).font(.caption2).foregroundStyle(CHTheme.textMuted)
                    }
                    presetRow
                    aiSuggestButton
                    modelSection
                    retouchSection
                    lutSection
                    metadataSection
                    runButton
                    if let msg = model.statusMessage {
                        Text(msg).font(.caption).foregroundStyle(CHTheme.textSecondary)
                    }
                }
                .padding(16)
            }
            .background(CHTheme.bg.ignoresSafeArea())
            .navigationTitle("AI-forbedring (sky)")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarLeading) { Button("Lukk") { dismiss() } }
                ToolbarItem(placement: .topBarTrailing) {
                    Button("Bruk") { Task { await model.apply { onApplied() }; dismiss() } }
                        .disabled(model.resultJPEG == nil || model.busy)
                }
            }
            .task { await model.loadLuts() }
        }
        .chBranded()
    }

    private var comparePane: some View {
        ZStack {
            CHTheme.surfaceElevated
            if let img = model.resultImage ?? model.beforeImage {
                Image(uiImage: img).resizable().scaledToFit()
            }
            if model.busy { ProgressView().padding(10).background(.black.opacity(0.4), in: Circle()) }
        }
        .frame(height: 320).clipShape(RoundedRectangle(cornerRadius: 14))
        .overlay(alignment: .topLeading) {
            Text(model.resultImage == nil ? "Original" : "Forbedret")
                .font(.caption2.weight(.semibold)).padding(.horizontal, 8).padding(.vertical, 4)
                .background(.black.opacity(0.45), in: Capsule()).foregroundStyle(.white).padding(8)
        }
    }

    private var presetRow: some View {
        Menu {
            ForEach(SkyEnhanceModel.presets, id: \.self) { p in Button(p.capitalized) { model.preset = p } }
        } label: {
            HStack { Text("Preset: \(model.preset.capitalized)").foregroundStyle(CHTheme.textPrimary)
                Spacer(); Image(systemName: "chevron.down").foregroundStyle(CHTheme.textMuted)
            }
            .padding(10).background(CHTheme.surface, in: RoundedRectangle(cornerRadius: 10))
        }
    }

    private var aiSuggestButton: some View {
        Button { Task { await model.suggest() } } label: {
            Label("Foreslå oppskrift (AI)", systemImage: "sparkles").frame(maxWidth: .infinity)
        }
        .buttonStyle(.bordered).controlSize(.large).tint(CHTheme.accent).disabled(model.busy)
    }

    private var modelSection: some View {
        card("Modell & oppløsning") {
            Menu {
                ForEach(SkyEnhanceModel.models, id: \.self) { m in Button(m) { model.settings.modelPreference = m } }
            } label: { rowLabel("Modell", model.settings.modelPreference) }
            Stepper("Oppskalering: \(model.settings.realesrganScale)×", value: $model.settings.realesrganScale, in: 1...4)
                .foregroundStyle(CHTheme.textPrimary)
            slider("Ansiktsforbedring", $model.settings.faceEnhancement, 0...100)
            slider("Støyreduksjon", $model.settings.denoising, 0...100)
            slider("Skarphet", $model.settings.sharpness, -100...100)
        }
    }

    private var retouchSection: some View {
        card("Tone & retusj") {
            slider("Lysstyrke", $model.settings.brightness, -100...100)
            slider("Kontrast", $model.settings.contrast, -100...100)
            slider("Metning", $model.settings.saturation, -100...100)
            slider("Hud-tekstur (bevar)", $model.settings.skinTextureGuard, 0...100)
            slider("Tenner", $model.settings.teethWhiteness, 0...100)
            slider("Øyne", $model.settings.eyeBrightness, 0...100)
            slider("Urenheter", $model.settings.blemishRemoval, 0...100)
        }
    }

    private var lutSection: some View {
        card("LUT (look)") {
            Menu {
                Button("Ingen") { model.settings.lut.name = nil }
                ForEach(model.luts) { l in Button(l.displayName ?? l.id) { model.settings.lut.name = l.id } }
            } label: { rowLabel("LUT", model.settings.lut.name ?? "Ingen") }
            if model.settings.lut.name != nil {
                slider("Styrke", $model.settings.lut.strength, 0...100)
            }
        }
    }

    private var metadataSection: some View {
        card("Levering — copyright") {
            TextField("Copyright (© 2026 …)", text: $model.copyright).textFieldStyle(.roundedBorder)
            TextField("Fotograf", text: $model.artist).textFieldStyle(.roundedBorder)
        }
    }

    private var runButton: some View {
        Group {
            if model.busy {
                Button(role: .destructive) { model.cancelRun() } label: {
                    HStack { ProgressView().controlSize(.small); Text("Avbryt") }
                        .frame(maxWidth: .infinity)
                }
                .buttonStyle(.bordered).controlSize(.large)
            } else {
                Button { model.run() } label: {
                    Label("Kjør forbedring", systemImage: "wand.and.stars").frame(maxWidth: .infinity)
                }
                .buttonStyle(.borderedProminent).controlSize(.large).tint(CHTheme.accent)
            }
        }
    }

    // helpers
    private func card<C: View>(_ title: String, @ViewBuilder _ content: () -> C) -> some View {
        VStack(alignment: .leading, spacing: 10) {
            Text(title).font(.subheadline.weight(.semibold)).foregroundStyle(CHTheme.textPrimary)
            content()
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(14).background(CHTheme.surface, in: RoundedRectangle(cornerRadius: 14))
    }
    private func rowLabel(_ title: String, _ value: String) -> some View {
        HStack { Text(title).foregroundStyle(CHTheme.textSecondary); Spacer()
            Text(value).foregroundStyle(CHTheme.accentSoft); Image(systemName: "chevron.down").font(.caption2).foregroundStyle(CHTheme.textMuted)
        }
    }
    private func slider(_ title: String, _ value: Binding<Int>, _ range: ClosedRange<Int>) -> some View {
        VStack(alignment: .leading, spacing: 2) {
            HStack { Text(title).font(.caption).foregroundStyle(CHTheme.textSecondary)
                Spacer(); Text("\(value.wrappedValue)").font(.caption).foregroundStyle(CHTheme.accentSoft)
            }
            Slider(value: Binding(get: { Double(value.wrappedValue) }, set: { value.wrappedValue = Int($0) }),
                   in: Double(range.lowerBound)...Double(range.upperBound)).tint(CHTheme.accent)
        }
    }
}
