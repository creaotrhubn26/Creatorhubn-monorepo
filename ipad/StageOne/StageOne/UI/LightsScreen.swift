import SwiftUI

/// Lyskonsollen: rigg + presets til venstre, live viewport + mixer i midten,
/// detalj for valgt lys til høyre. Samme SceneDocument som Studio.
struct LightsScreen: View {
    let document: SceneDocument
    let renderer: StageRenderer

    @State private var orbit: OrbitCamera = .default
    @State private var tool: EditorTool = .move // draggbare fixtures
    @State private var lookThrough: String?
    @State private var dragSnapshot: SceneData?

    private var lightNodes: [Node] { document.data.nodes.filter { $0.kind == .light } }

    var body: some View {
        HStack(spacing: 0) {
            rigPanel
            divider
            VStack(spacing: 0) {
                ViewportView(document: document, renderer: renderer,
                             orbit: $orbit, tool: $tool, lookThroughCameraId: $lookThrough)
                Rectangle().fill(Theme.border).frame(height: Theme.hairline)
                mixer
            }
            divider
            detailPanel
        }
        .onAppear {
            if document.selectedNodeId.flatMap({ document.data.node($0)?.kind }) != .light {
                document.selectedNodeId = lightNodes.first?.id
            }
        }
    }

    private var divider: some View {
        Rectangle().fill(Theme.border).frame(width: Theme.hairline)
    }

    // MARK: - Venstre: rigg + presets + add

    private var rigPanel: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 16) {
                section("Rig") {
                    ForEach(lightNodes) { node in
                        lightRow(node)
                    }
                }
                section("Presets") {
                    ForEach(LightPresets.all) { preset in
                        Button {
                            LightPresets.apply(preset, to: document)
                        } label: {
                            HStack {
                                Text(preset.name)
                                    .font(.system(size: 12, weight: .medium))
                                    .foregroundStyle(Theme.fg)
                                Spacer()
                                Text(preset.summary)
                                    .font(Theme.mono(10))
                                    .foregroundStyle(Theme.muted)
                            }
                            .padding(.horizontal, 10)
                            .padding(.vertical, 8)
                            .background(RoundedRectangle(cornerRadius: 8).fill(Theme.raise))
                            .overlay(RoundedRectangle(cornerRadius: 8).stroke(Theme.border, lineWidth: Theme.hairline))
                        }
                        .buttonStyle(.plain)
                    }
                }
                section("Add light") {
                    HStack(spacing: 6) {
                        addButton("Spot", type: .spot)
                        addButton("Area", type: .area)
                    }
                }
            }
            .padding(12)
        }
        .frame(width: 264)
        .background(Theme.surface)
    }

    private func section(_ title: String, @ViewBuilder content: () -> some View) -> some View {
        VStack(alignment: .leading, spacing: 6) {
            InspectorSectionHeader(title: title)
            content()
        }
    }

    private func lightRow(_ node: Node) -> some View {
        let selected = document.selectedNodeId == node.id
        let subtitle: String = if case .light(let p) = node.params {
            "\(p.type == .spot ? "Spot" : "Area") · \(Int(p.intensity))%"
        } else { "" }
        return Button {
            document.selectedNodeId = node.id
        } label: {
            HStack(spacing: 8) {
                Image(systemName: "lightbulb")
                    .font(.system(size: 12))
                    .foregroundStyle(selected ? Theme.accent : Theme.muted)
                Text(node.name)
                    .font(.system(size: 13))
                    .foregroundStyle(node.enabled ? Theme.fg : Theme.muted)
                Spacer()
                Text(subtitle)
                    .font(Theme.mono(10))
                    .foregroundStyle(Theme.muted)
            }
            .padding(.horizontal, 8)
            .padding(.vertical, 6)
            .background(RoundedRectangle(cornerRadius: 8)
                .fill(selected ? Theme.accent.opacity(0.14) : .clear))
        }
        .buttonStyle(.plain)
    }

    private func addButton(_ label: String, type: LightType) -> some View {
        Button {
            addLight(type: type, label: label)
        } label: {
            Label(label, systemImage: "plus")
                .font(.system(size: 12, weight: .medium))
                .foregroundStyle(Theme.fg)
                .frame(maxWidth: .infinity)
                .padding(.vertical, 7)
                .background(RoundedRectangle(cornerRadius: 8).fill(Theme.raise))
                .overlay(RoundedRectangle(cornerRadius: 8).stroke(Theme.border, lineWidth: Theme.hairline))
        }
        .buttonStyle(.plain)
    }

    private func addLight(type: LightType, label: String) {
        let id = "light-\(UUID().uuidString.prefix(8).lowercased())"
        let count = lightNodes.count + 1
        document.mutate { scene in
            scene.nodes.append(Node(
                id: id, name: "\(label) Light \(count)", kind: .light, enabled: true,
                transform: Transform(position: [0, 3, 2], rotationEulerDeg: [-40, 0, 0], scale: .one),
                params: .light(LightParams(type: type, intensity: 60, temperatureK: 5600,
                                           beamDeg: 50, castsShadows: false, quality: "Medium"))
            ))
            if let i = scene.groups.firstIndex(where: { $0.id == "lights" }) {
                scene.groups[i].childIds.append(id)
            }
        }
        document.selectedNodeId = id
    }

    // MARK: - Mixer

    private var mixer: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(alignment: .top, spacing: 10) {
                ForEach(lightNodes) { node in
                    mixerStrip(node)
                }
            }
            .padding(12)
        }
        .frame(height: 168)
        .background(Theme.surface)
    }

    @ViewBuilder
    private func mixerStrip(_ node: Node) -> some View {
        if case .light(let p) = node.params {
            let selected = document.selectedNodeId == node.id
            VStack(alignment: .leading, spacing: 8) {
                HStack(spacing: 6) {
                    Image(systemName: "lightbulb")
                        .font(.system(size: 11))
                        .foregroundStyle(selected ? Theme.accent : Theme.muted)
                    Text(node.name)
                        .font(.system(size: 12, weight: .medium))
                        .foregroundStyle(Theme.fg)
                        .lineLimit(1)
                    Text(p.type == .spot ? "Spot" : "Area")
                        .font(.system(size: 9, weight: .medium))
                        .foregroundStyle(Theme.muted)
                        .padding(.horizontal, 5)
                        .padding(.vertical, 1)
                        .background(Capsule().fill(Theme.raise))
                    Spacer()
                    Toggle("", isOn: Binding(
                        get: { node.enabled },
                        set: { on in document.updateNode(node.id) { $0.enabled = on } }
                    ))
                    .labelsHidden()
                    .tint(Theme.accent)
                    .scaleEffect(0.7)
                }
                paramSlider(node.id, "Intensity", "%", 0...100, p.intensity) { v, light in
                    light.intensity = v
                }
                paramSlider(node.id, "Temperature", "K", 2700...7500, p.temperatureK, step: 50) { v, light in
                    light.temperatureK = v
                }
            }
            .padding(10)
            .frame(width: 250)
            .background(RoundedRectangle(cornerRadius: 10).fill(selected ? Theme.accent.opacity(0.10) : Theme.bg.opacity(0.5)))
            .overlay(RoundedRectangle(cornerRadius: 10)
                .stroke(selected ? Theme.accent.opacity(0.5) : Theme.border, lineWidth: Theme.hairline))
            .onTapGesture { document.selectedNodeId = node.id }
        }
    }

    // MARK: - Detalj

    private var detailPanel: some View {
        VStack(spacing: 0) {
            HStack {
                Text("Light")
                    .font(.system(size: 12, weight: .semibold))
                    .foregroundStyle(Theme.muted)
                    .textCase(.uppercase)
                    .kerning(0.5)
                Spacer()
            }
            .padding(.horizontal, 14)
            .padding(.vertical, 10)

            if let node = selectedLight, case .light(let p) = node.params {
                ScrollView {
                    VStack(alignment: .leading, spacing: 14) {
                        Text(node.name)
                            .font(.system(size: 14, weight: .semibold))
                            .foregroundStyle(Theme.fg)
                        paramSlider(node.id, "Beam Angle", "°", 10...120, p.beamDeg) { v, light in
                            light.beamDeg = v
                        }
                        Toggle(isOn: Binding(
                            get: { p.castsShadows },
                            set: { on in
                                document.updateNode(node.id) {
                                    if case .light(var lp) = $0.params { lp.castsShadows = on; $0.params = .light(lp) }
                                }
                            }
                        )) {
                            Text("Shadows").font(.system(size: 12)).foregroundStyle(Theme.muted)
                        }
                        .tint(Theme.accent)
                        SegmentPicker(options: ["Low", "Medium", "High"], selection: p.quality) { sel in
                            document.updateNode(node.id) {
                                if case .light(var lp) = $0.params { lp.quality = sel; $0.params = .light(lp) }
                            }
                        }
                    }
                    .padding(14)
                }
            } else {
                Spacer()
                Text("Velg et lys")
                    .font(.system(size: 13))
                    .foregroundStyle(Theme.muted)
                Spacer()
            }
        }
        .frame(width: 280)
        .background(Theme.surface)
    }

    private var selectedLight: Node? {
        guard let id = document.selectedNodeId,
              let node = document.data.node(id), node.kind == .light else { return nil }
        return node
    }

    // MARK: - Delt slider-hjelper (transient undo, samme mønster som inspector)

    private func paramSlider(_ nodeId: String, _ label: String, _ unit: String,
                             _ range: ClosedRange<Double>, _ value: Double, step: Double = 1,
                             apply: @escaping (Double, inout LightParams) -> Void) -> ValueChipSlider {
        ValueChipSlider(label: label, unit: unit, range: range, step: step, value: value) { v in
            if dragSnapshot == nil { dragSnapshot = document.data }
            document.updateNodeTransient(nodeId) {
                if case .light(var p) = $0.params { apply(v, &p); $0.params = .light(p) }
            }
        } onCommit: {
            if let snapshot = dragSnapshot {
                document.commitTransient(from: snapshot)
                dragSnapshot = nil
            }
        }
    }
}
