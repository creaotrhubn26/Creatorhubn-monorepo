import SwiftUI

// MARK: - Rectangle marquee (shared by Beskjær + Masker)

/// Draw a rectangle over the fitted image and return it in normalised image
/// coordinates (origin top-left, 0…1). Used for crop and for marking a region
/// to inpaint.
struct RectMarqueeSheet: View {
    let imagePath: String
    let title: String
    let applyLabel: String
    let initialRect: CGRect?
    let allowReset: Bool
    let onReset: () -> Void
    let onApply: (CGRect) -> Void

    @Environment(\.dismiss) private var dismiss
    @State private var startPoint: CGPoint?
    @State private var currentRect: CGRect?   // in container coords

    var body: some View {
        NavigationStack {
            GeometryReader { geo in
                let image = UIImage(contentsOfFile: imagePath)
                let fitted = fittedRect(image: image?.size ?? .zero, in: geo.size)
                ZStack {
                    CHTheme.bg
                    if let image {
                        Image(uiImage: image).resizable().scaledToFit()
                    }
                    if let r = displayRect(in: fitted) {
                        Rectangle().path(in: r).stroke(CHTheme.accent, lineWidth: 2)
                        Rectangle().path(in: r).fill(CHTheme.accent.opacity(0.12))
                    }
                }
                .accessibilityElement(children: .ignore)
                .accessibilityLabel("Beskjæringslerret")
                .accessibilityIdentifier("redigering-crop-canvas")
                .contentShape(Rectangle())
                .gesture(
                    DragGesture(minimumDistance: 4)
                        .onChanged { v in
                            let s = startPoint ?? v.startLocation
                            startPoint = s
                            let r = CGRect(x: min(s.x, v.location.x), y: min(s.y, v.location.y),
                                           width: abs(v.location.x - s.x), height: abs(v.location.y - s.y))
                                .intersection(fitted)
                            currentRect = r
                            if fitted.width > 0, fitted.height > 0 {
                                normalized = CGRect(x: (r.minX - fitted.minX) / fitted.width,
                                                    y: (r.minY - fitted.minY) / fitted.height,
                                                    width: r.width / fitted.width,
                                                    height: r.height / fitted.height)
                            }
                        }
                        .onEnded { _ in startPoint = nil }
                )
            }
            .background(CHTheme.bg.ignoresSafeArea())
            .navigationTitle(title)
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarLeading) { Button("Avbryt") { dismiss() } }
                ToolbarItem(placement: .topBarTrailing) {
                    Button(applyLabel) { apply() }.disabled(currentRect == nil || (currentRect?.width ?? 0) < 8)
                }
                if allowReset {
                    ToolbarItem(placement: .bottomBar) {
                        Button("Tilbakestill", role: .destructive) { onReset(); dismiss() }
                    }
                }
            }
        }
        .chBranded()
    }

    private func fittedRect(image: CGSize, in container: CGSize) -> CGRect {
        guard image.width > 0, image.height > 0 else { return CGRect(origin: .zero, size: container) }
        let scale = min(container.width / image.width, container.height / image.height)
        let w = image.width * scale, h = image.height * scale
        return CGRect(x: (container.width - w) / 2, y: (container.height - h) / 2, width: w, height: h)
    }

    private func displayRect(in fitted: CGRect) -> CGRect? {
        if let currentRect { return currentRect }
        if let initialRect {
            return CGRect(x: fitted.minX + initialRect.minX * fitted.width,
                          y: fitted.minY + initialRect.minY * fitted.height,
                          width: initialRect.width * fitted.width, height: initialRect.height * fitted.height)
        }
        return nil
    }

    private func apply() {
        guard let norm = normalized else { return }
        onApply(norm.intersection(CGRect(x: 0, y: 0, width: 1, height: 1)))
        dismiss()
    }

    /// Normalised rect (0…1, image space) computed live during the drag.
    @State private var normalized: CGRect?
}

// MARK: - Face-aware portrait crop

/// Deterministic crop geometry shared by the UI and tests. Vision face rects use
/// a bottom-left origin; Capture's crop persistence uses a top-left origin.
struct PortraitCropSettings: Equatable, Sendable, Codable {
    enum Aspect: String, CaseIterable, Identifiable, Sendable, Codable {
        case original, square, fourFive, threeFour, twoThree

        var id: String { rawValue }
        var label: String {
            switch self {
            case .original: "Original"
            case .square: "1:1"
            case .fourFive: "4:5"
            case .threeFour: "3:4"
            case .twoThree: "2:3"
            }
        }

        func widthOverHeight(imageSize: CGSize) -> CGFloat {
            switch self {
            case .original: imageSize.width / max(1, imageSize.height)
            case .square: 1
            case .fourFive: 4 / 5
            case .threeFour: 3 / 4
            case .twoThree: 2 / 3
            }
        }
    }

    var aspect: Aspect = .fourFive
    /// Detected face height as a fraction of the final crop height.
    var headSize: Double = 0.36
    /// Space from crop top to detected face top, relative to crop height.
    var topMargin: Double = 0.10
    /// Face centre position across the final crop (0.25 left … 0.75 right).
    var horizontalPosition: Double = 0.50
}

enum CompositionGuide: String, CaseIterable, Identifiable, Sendable, Codable {
    case none, thirds, goldenRatio, center, diagonals, safeArea

    var id: String { rawValue }
    var label: String {
        switch self {
        case .none: "Ingen"
        case .thirds: "Tredelingsregel"
        case .goldenRatio: "Det gylne snitt"
        case .center: "Senter"
        case .diagonals: "Diagonaler"
        case .safeArea: "Sikkerhetssone"
        }
    }

    var icon: String {
        switch self {
        case .none: "rectangle"
        case .thirds: "grid"
        case .goldenRatio: "circle.hexagongrid"
        case .center: "scope"
        case .diagonals: "square.split.diagonal.2x2"
        case .safeArea: "rectangle.inset.filled"
        }
    }
}

struct CompositionGuideLine: Equatable, Sendable {
    let start: CGPoint
    let end: CGPoint
}

/// Pure geometry keeps guide placement deterministic and testable. Coordinates
/// are expressed directly in the preview canvas so the overlay always follows
/// the active crop, regardless of image orientation or fitted-image padding.
enum CompositionGuideGeometry {
    static func lines(for guide: CompositionGuide, in rect: CGRect) -> [CompositionGuideLine] {
        guard rect.width > 1, rect.height > 1 else { return [] }

        func grid(at positions: [CGFloat]) -> [CompositionGuideLine] {
            positions.flatMap { fraction -> [CompositionGuideLine] in
                let x = rect.minX + rect.width * fraction
                let y = rect.minY + rect.height * fraction
                return [
                    .init(start: CGPoint(x: x, y: rect.minY), end: CGPoint(x: x, y: rect.maxY)),
                    .init(start: CGPoint(x: rect.minX, y: y), end: CGPoint(x: rect.maxX, y: y))
                ]
            }
        }

        switch guide {
        case .none, .safeArea:
            return []
        case .thirds:
            return grid(at: [1 / 3, 2 / 3])
        case .goldenRatio:
            return grid(at: [0.381_966, 0.618_034])
        case .center:
            return [
                .init(start: CGPoint(x: rect.midX, y: rect.minY), end: CGPoint(x: rect.midX, y: rect.maxY)),
                .init(start: CGPoint(x: rect.minX, y: rect.midY), end: CGPoint(x: rect.maxX, y: rect.midY))
            ]
        case .diagonals:
            return [
                .init(start: CGPoint(x: rect.minX, y: rect.minY), end: CGPoint(x: rect.maxX, y: rect.maxY)),
                .init(start: CGPoint(x: rect.maxX, y: rect.minY), end: CGPoint(x: rect.minX, y: rect.maxY))
            ]
        }
    }

    static func frames(for guide: CompositionGuide, in rect: CGRect) -> [CGRect] {
        guard guide == .safeArea, rect.width > 1, rect.height > 1 else { return [] }
        return [rect.insetBy(dx: rect.width * 0.10, dy: rect.height * 0.10)]
    }
}

struct CompositionGuideOverlay: View {
    let guide: CompositionGuide
    let rect: CGRect

    var body: some View {
        Canvas { context, _ in
            let lines = CompositionGuideGeometry.lines(for: guide, in: rect)
            let frames = CompositionGuideGeometry.frames(for: guide, in: rect)
            guard !lines.isEmpty || !frames.isEmpty else { return }

            var path = Path()
            for line in lines {
                path.move(to: line.start)
                path.addLine(to: line.end)
            }
            for frame in frames { path.addRect(frame) }
            if guide == .center {
                let diameter = max(10, min(rect.width, rect.height) * 0.035)
                path.addEllipse(in: CGRect(
                    x: rect.midX - diameter / 2,
                    y: rect.midY - diameter / 2,
                    width: diameter,
                    height: diameter
                ))
            }

            // A dark keyline keeps the guide readable over highlights; the
            // fine white line remains unobtrusive over dark areas.
            context.stroke(path, with: .color(.black.opacity(0.62)), lineWidth: 2.5)
            context.stroke(path, with: .color(.white.opacity(0.88)), lineWidth: 1)
        }
        .allowsHitTesting(false)
        .accessibilityHidden(true)
    }
}

struct CropPreset: Identifiable, Equatable, Sendable, Codable {
    var id: UUID
    var name: String
    var settings: PortraitCropSettings
    var guide: CompositionGuide
}

enum CropPresetStore {
    private static let key = "creatorhub.redigering.crop-presets.v1"

    static func load(defaults: UserDefaults = .standard) -> [CropPreset] {
        guard let data = defaults.data(forKey: key),
              let presets = try? JSONDecoder().decode([CropPreset].self, from: data) else { return [] }
        return presets.sorted { $0.name.localizedCaseInsensitiveCompare($1.name) == .orderedAscending }
    }

    static func save(_ presets: [CropPreset], defaults: UserDefaults = .standard) {
        guard let data = try? JSONEncoder().encode(presets) else { return }
        defaults.set(data, forKey: key)
    }

    static func upsert(
        name rawName: String,
        settings: PortraitCropSettings,
        guide: CompositionGuide,
        defaults: UserDefaults = .standard
    ) -> [CropPreset] {
        let name = rawName.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !name.isEmpty else { return load(defaults: defaults) }
        var presets = load(defaults: defaults)
        if let index = presets.firstIndex(where: {
            $0.name.compare(name, options: [.caseInsensitive, .diacriticInsensitive]) == .orderedSame
        }) {
            presets[index].settings = settings
            presets[index].guide = guide
        } else {
            presets.append(.init(id: UUID(), name: name, settings: settings, guide: guide))
        }
        save(presets, defaults: defaults)
        return load(defaults: defaults)
    }

    static func remove(_ preset: CropPreset, defaults: UserDefaults = .standard) -> [CropPreset] {
        let presets = load(defaults: defaults).filter { $0.id != preset.id }
        save(presets, defaults: defaults)
        return presets
    }
}

enum PortraitCropAdvisor {
    /// Returns a normalised, top-left crop rect contained by the image. The face
    /// remains inside the crop even when a requested composition hits an edge.
    static func crop(
        faceRectVision face: CGRect,
        imageSize: CGSize,
        settings: PortraitCropSettings
    ) -> CGRect? {
        guard imageSize.width > 1, imageSize.height > 1,
              face.width > 0.001, face.height > 0.001 else { return nil }

        let faceTopLeft = CGRect(
            x: face.minX,
            y: 1 - face.maxY,
            width: face.width,
            height: face.height
        ).intersection(CGRect(x: 0, y: 0, width: 1, height: 1))
        guard !faceTopLeft.isEmpty else { return nil }

        let headFraction = CGFloat(max(0.18, min(0.70, settings.headSize)))
        var cropHeight = max(faceTopLeft.height, faceTopLeft.height / headFraction)
        let outputAspect = settings.aspect.widthOverHeight(imageSize: imageSize)
        let normalisedAspect = outputAspect * imageSize.height / imageSize.width
        var cropWidth = cropHeight * normalisedAspect

        // Preserve aspect while fitting the requested rectangle inside the image.
        let fitScale = min(1, min(1 / max(cropWidth, 0.0001), 1 / max(cropHeight, 0.0001)))
        cropWidth *= fitScale
        cropHeight *= fitScale

        let horizontal = CGFloat(max(0.25, min(0.75, settings.horizontalPosition)))
        let margin = CGFloat(max(0, min(0.30, settings.topMargin)))
        var x = faceTopLeft.midX - horizontal * cropWidth
        var y = faceTopLeft.minY - margin * cropHeight

        // Keep the full detected face in frame before clamping to image edges.
        x = max(faceTopLeft.maxX - cropWidth, min(faceTopLeft.minX, x))
        y = max(faceTopLeft.maxY - cropHeight, min(faceTopLeft.minY, y))
        x = max(0, min(1 - cropWidth, x))
        y = max(0, min(1 - cropHeight, y))

        let result = CGRect(x: x, y: y, width: cropWidth, height: cropHeight)
        guard result.width > 0.01, result.height > 0.01 else { return nil }
        return result
    }
}

/// Crop workspace with a face-aware proposal and the existing freehand rectangle
/// as a lossless fallback. Only the final normalised crop is persisted.
struct SmartCropSheet: View {
    let imagePath: String
    let faceRectsVision: [CGRect]
    let initialRect: CGRect?
    let onReset: () -> Void
    let onApply: (CGRect) -> Void

    private enum Mode: String, CaseIterable {
        case face = "AI-ansikt"
        case manual = "Manuell"
    }

    @Environment(\.dismiss) private var dismiss
    @State private var mode: Mode
    @State private var settings = PortraitCropSettings()
    @State private var selectedFace = 0
    @State private var manualRect: CGRect?
    @State private var showManual = false
    @State private var guide: CompositionGuide = .thirds
    @State private var presets: [CropPreset] = CropPresetStore.load()
    @State private var showSavePreset = false
    @State private var presetName = ""

    init(
        imagePath: String,
        faceRectsVision: [CGRect],
        initialRect: CGRect?,
        onReset: @escaping () -> Void,
        onApply: @escaping (CGRect) -> Void
    ) {
        self.imagePath = imagePath
        self.faceRectsVision = faceRectsVision
        self.initialRect = initialRect
        self.onReset = onReset
        self.onApply = onApply
        _mode = State(initialValue: faceRectsVision.isEmpty ? .manual : .face)
        _manualRect = State(initialValue: initialRect)
    }

    private var image: UIImage? { UIImage(contentsOfFile: imagePath) }
    private var faces: [CGRect] {
        faceRectsVision
            .filter { $0.width > 0.001 && $0.height > 0.001 }
            .sorted { $0.width * $0.height > $1.width * $1.height }
    }
    private var safeFaceIndex: Int { min(max(0, selectedFace), max(0, faces.count - 1)) }
    private var proposedCrop: CGRect? {
        guard let image, faces.indices.contains(safeFaceIndex) else { return nil }
        return PortraitCropAdvisor.crop(
            faceRectVision: faces[safeFaceIndex],
            imageSize: image.size,
            settings: settings
        )
    }
    private var activeCrop: CGRect? { mode == .face ? proposedCrop : manualRect }

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(spacing: 16) {
                    Picker("Beskjæringsmodus", selection: $mode) {
                        ForEach(Mode.allCases, id: \.rawValue) { Text($0.rawValue).tag($0) }
                    }
                    .pickerStyle(.segmented)
                    .accessibilityIdentifier("redigering-crop-mode")

                    cropPreview
                        .frame(minHeight: 300, idealHeight: 430, maxHeight: 500)

                    if mode == .face { faceControls } else { manualControls }
                    compositionControls

                    Button("Tilbakestill beskjæring", role: .destructive) {
                        onReset()
                        dismiss()
                    }
                    .buttonStyle(.bordered)
                }
                .padding(16)
            }
            .background(CHTheme.bg.ignoresSafeArea())
            .navigationTitle("Beskjær")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarLeading) {
                    Button("Avbryt") { dismiss() }
                }
                ToolbarItem(placement: .topBarTrailing) {
                    Button("Bruk") {
                        guard let activeCrop else { return }
                        onApply(activeCrop)
                        dismiss()
                    }
                    .disabled(activeCrop == nil)
                }
            }
        }
        .onChange(of: faces.count) { _, count in
            // Analysis can finish just after the sheet is presented. Prefer the
            // face proposal once it becomes available unless the photographer
            // already has a manual crop in progress.
            if count > 0, manualRect == nil { mode = .face }
        }
        .sheet(isPresented: $showManual) {
            RectMarqueeSheet(
                imagePath: imagePath,
                title: "Fri beskjæring",
                applyLabel: "Bruk utsnitt",
                initialRect: manualRect,
                allowReset: true,
                onReset: { manualRect = nil },
                onApply: { rect in manualRect = rect; mode = .manual }
            )
        }
        .alert("Lagre beskjæringspreset", isPresented: $showSavePreset) {
            TextField("Presetnavn", text: $presetName)
            Button("Lagre") {
                presets = CropPresetStore.upsert(name: presetName, settings: settings, guide: guide)
                presetName = ""
            }
            .disabled(presetName.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty)
            Button("Avbryt", role: .cancel) { presetName = "" }
        } message: {
            Text("Lagrer sideforhold, AI-plassering og komposisjonsguide på denne iPaden.")
        }
        .chBranded()
    }

    private var cropPreview: some View {
        GeometryReader { geo in
            let fitted = fittedRect(imageSize: image?.size ?? .zero, container: geo.size)
            ZStack {
                CHTheme.surfaceElevated
                if let image {
                    Image(uiImage: image).resizable().scaledToFit()
                }
                if let crop = activeCrop {
                    let display = CGRect(
                        x: fitted.minX + crop.minX * fitted.width,
                        y: fitted.minY + crop.minY * fitted.height,
                        width: crop.width * fitted.width,
                        height: crop.height * fitted.height
                    )
                    cropDimmingPath(outer: fitted, crop: display)
                        .fill(.black.opacity(0.48), style: FillStyle(eoFill: true))
                    Rectangle().path(in: display).stroke(CHTheme.accent, lineWidth: 2)
                    CompositionGuideOverlay(guide: guide, rect: display)
                } else if !fitted.isEmpty {
                    CompositionGuideOverlay(guide: guide, rect: fitted)
                }
            }
            .clipShape(RoundedRectangle(cornerRadius: 14))
            .accessibilityElement(children: .ignore)
            .accessibilityLabel(activeCrop == nil ? "Ingen beskjæring tilgjengelig" : "Forhåndsvisning av beskjæring")
            .accessibilityIdentifier("redigering-crop-preview")
        }
    }

    @ViewBuilder private var faceControls: some View {
        if faces.isEmpty {
            ContentUnavailableView(
                "Fant ikke et sikkert ansikt",
                systemImage: "person.crop.circle.badge.questionmark",
                description: Text("Velg Manuell for å tegne utsnittet selv.")
            )
        } else {
            VStack(alignment: .leading, spacing: 14) {
                HStack {
                    Label("AI-plassering", systemImage: "person.crop.rectangle")
                        .font(.headline).foregroundStyle(CHTheme.textPrimary)
                    Spacer()
                    if faces.count > 1 {
                        Picker("Ansikt", selection: $selectedFace) {
                            ForEach(faces.indices, id: \.self) { Text("Ansikt \($0 + 1)").tag($0) }
                        }
                        .pickerStyle(.menu)
                    }
                }
                HStack {
                    Text("Sideforhold").foregroundStyle(CHTheme.textSecondary)
                    Spacer()
                    Picker("Sideforhold", selection: $settings.aspect) {
                        ForEach(PortraitCropSettings.Aspect.allCases) { Text($0.label).tag($0) }
                    }
                    .pickerStyle(.menu)
                }
                cropSlider("Hodestørrelse", value: $settings.headSize, range: 0.18...0.70)
                cropSlider("Toppmargin", value: $settings.topMargin, range: 0...0.30)
                cropSlider("Horisontal ansiktsplassering", value: $settings.horizontalPosition, range: 0.25...0.75)
                Text("Ansiktet holdes alltid innenfor bildet. Utsnittet er ikke-destruktivt og kan endres senere.")
                    .font(.caption2).foregroundStyle(CHTheme.textMuted)
            }
            .padding(14)
            .background(CHTheme.surface, in: RoundedRectangle(cornerRadius: 14))
        }
    }

    private var manualControls: some View {
        VStack(alignment: .leading, spacing: 10) {
            Text(manualRect == nil ? "Tegn et fritt utsnitt på bildet." : "Manuelt utsnitt er klart.")
                .font(.subheadline).foregroundStyle(CHTheme.textSecondary)
            Button {
                showManual = true
            } label: {
                Label(manualRect == nil ? "Tegn utsnitt" : "Juster utsnitt", systemImage: "crop")
                    .frame(maxWidth: .infinity)
            }
            .buttonStyle(.borderedProminent).tint(CHTheme.accent)
        }
        .padding(14)
        .background(CHTheme.surface, in: RoundedRectangle(cornerRadius: 14))
    }

    private var compositionControls: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack {
                Label("Komposisjon", systemImage: guide.icon)
                    .font(.headline).foregroundStyle(CHTheme.textPrimary)
                Spacer()
                Picker("Komposisjonsguide", selection: $guide) {
                    ForEach(CompositionGuide.allCases) { item in
                        Label(item.label, systemImage: item.icon).tag(item)
                    }
                }
                .pickerStyle(.menu)
                .accessibilityIdentifier("redigering-crop-guide")
            }

            HStack(spacing: 8) {
                Menu {
                    if presets.isEmpty {
                        Text("Ingen lagrede presets")
                    } else {
                        ForEach(presets) { preset in
                            Button(preset.name) {
                                settings = preset.settings
                                guide = preset.guide
                                mode = faces.isEmpty ? .manual : .face
                            }
                        }
                        Divider()
                        Menu("Slett preset") {
                            ForEach(presets) { preset in
                                Button(preset.name, role: .destructive) {
                                    presets = CropPresetStore.remove(preset)
                                }
                            }
                        }
                    }
                } label: {
                    Label("Crop-presets", systemImage: "bookmark")
                        .frame(maxWidth: .infinity)
                }
                .buttonStyle(.bordered)

                Button {
                    showSavePreset = true
                } label: {
                    Label("Lagre", systemImage: "bookmark.fill")
                        .frame(maxWidth: .infinity)
                }
                .buttonStyle(.bordered).tint(CHTheme.accent)
            }

            Text("Guidene er kun et hjelpeoverlegg og blir aldri med i eksporten.")
                .font(.caption2).foregroundStyle(CHTheme.textMuted)
        }
        .padding(14)
        .background(CHTheme.surface, in: RoundedRectangle(cornerRadius: 14))
    }

    private func cropDimmingPath(outer: CGRect, crop: CGRect) -> Path {
        var path = Path()
        path.addRect(outer)
        path.addRect(crop)
        return path
    }

    private func cropSlider(
        _ title: String,
        value: Binding<Double>,
        range: ClosedRange<Double>
    ) -> some View {
        VStack(alignment: .leading, spacing: 4) {
            HStack {
                Text(title).font(.subheadline).foregroundStyle(CHTheme.textPrimary)
                Spacer()
                Text("\(Int((value.wrappedValue * 100).rounded())) %")
                    .font(.caption.monospacedDigit()).foregroundStyle(CHTheme.accentSoft)
            }
            Slider(value: value, in: range).tint(CHTheme.accent)
        }
    }

    private func fittedRect(imageSize: CGSize, container: CGSize) -> CGRect {
        guard imageSize.width > 0, imageSize.height > 0 else {
            return CGRect(origin: .zero, size: container)
        }
        let scale = min(container.width / imageSize.width, container.height / imageSize.height)
        let size = CGSize(width: imageSize.width * scale, height: imageSize.height * scale)
        return CGRect(
            x: (container.width - size.width) / 2,
            y: (container.height - size.height) / 2,
            width: size.width,
            height: size.height
        )
    }
}

// MARK: - Freehand retouch brush

struct NormalizedBrushStroke: Sendable {
    var points: [CGPoint]
}

/// Freehand removal mask. SwiftUI's drag input also receives Apple Pencil
/// events, while the normalized path keeps the mask independent of screen size
/// and lets the backend work against the source pixel dimensions.
struct RetouchBrushSheet: View {
    let imagePath: String
    let onApply: ([NormalizedBrushStroke], CGFloat) -> Void

    @Environment(\.dismiss) private var dismiss
    @State private var strokes: [NormalizedBrushStroke] = []
    @State private var active: [CGPoint] = []
    /// Diameter as a fraction of the image's shortest edge.
    @State private var brushDiameter: CGFloat = 0.025

    var body: some View {
        NavigationStack {
            VStack(spacing: 0) {
                GeometryReader { geo in
                    let image = UIImage(contentsOfFile: imagePath)
                    let fitted = fittedRect(image: image?.size ?? .zero, in: geo.size)
                    ZStack {
                        CHTheme.bg
                        if let image { Image(uiImage: image).resizable().scaledToFit() }
                        Canvas { context, _ in
                            for stroke in strokes + (active.isEmpty ? [] : [.init(points: active)]) {
                                draw(stroke, in: fitted, context: &context)
                            }
                        }
                        .allowsHitTesting(false)
                    }
                    .contentShape(Rectangle())
                    .gesture(
                        DragGesture(minimumDistance: 0)
                            .onChanged { value in
                                guard fitted.contains(value.location), fitted.width > 0, fitted.height > 0 else { return }
                                let p = CGPoint(
                                    x: (value.location.x - fitted.minX) / fitted.width,
                                    y: (value.location.y - fitted.minY) / fitted.height
                                )
                                if active.isEmpty || distance(active.last!, p) > 0.002 { active.append(p) }
                            }
                            .onEnded { _ in
                                if !active.isEmpty { strokes.append(.init(points: active)); active = [] }
                            }
                    )
                    .accessibilityElement(children: .ignore)
                    .accessibilityLabel("Retusjeringspensel")
                    .accessibilityHint("Tegn over området som skal fjernes")
                }
                HStack(spacing: 12) {
                    Image(systemName: "smallcircle.filled.circle")
                    Slider(value: $brushDiameter, in: 0.008...0.09).tint(CHTheme.accent)
                    Image(systemName: "largecircle.fill.circle")
                    Button("Angre strøk") { if !strokes.isEmpty { strokes.removeLast() } }
                        .disabled(strokes.isEmpty)
                }
                .font(.caption)
                .foregroundStyle(CHTheme.textSecondary)
                .padding(14)
                .background(CHTheme.surface)
            }
            .background(CHTheme.bg.ignoresSafeArea())
            .navigationTitle("Retusjeringspensel")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarLeading) { Button("Avbryt") { dismiss() } }
                ToolbarItem(placement: .topBarTrailing) {
                    Button("Fjern markert") {
                        onApply(strokes, brushDiameter)
                        dismiss()
                    }
                    .disabled(strokes.isEmpty)
                }
            }
        }
        .chBranded()
    }

    private func draw(_ stroke: NormalizedBrushStroke, in fitted: CGRect, context: inout GraphicsContext) {
        guard let first = stroke.points.first else { return }
        var path = Path()
        path.move(to: canvasPoint(first, fitted))
        if stroke.points.count == 1 {
            path.addLine(to: canvasPoint(CGPoint(x: first.x + 0.0001, y: first.y), fitted))
        } else {
            for point in stroke.points.dropFirst() { path.addLine(to: canvasPoint(point, fitted)) }
        }
        context.stroke(
            path,
            with: .color(CHTheme.accent.opacity(0.82)),
            style: StrokeStyle(
                lineWidth: brushDiameter * min(fitted.width, fitted.height),
                lineCap: .round,
                lineJoin: .round
            )
        )
    }

    private func canvasPoint(_ point: CGPoint, _ fitted: CGRect) -> CGPoint {
        CGPoint(x: fitted.minX + point.x * fitted.width, y: fitted.minY + point.y * fitted.height)
    }

    private func fittedRect(image: CGSize, in container: CGSize) -> CGRect {
        guard image.width > 0, image.height > 0 else { return CGRect(origin: .zero, size: container) }
        let scale = min(container.width / image.width, container.height / image.height)
        let size = CGSize(width: image.width * scale, height: image.height * scale)
        return CGRect(x: (container.width - size.width) / 2,
                      y: (container.height - size.height) / 2,
                      width: size.width, height: size.height)
    }

    private func distance(_ a: CGPoint, _ b: CGPoint) -> CGFloat {
        hypot(a.x - b.x, a.y - b.y)
    }
}
