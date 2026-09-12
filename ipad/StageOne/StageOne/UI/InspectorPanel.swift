import SwiftUI

struct InspectorPanel: View {
    let document: SceneDocument

    /// Snapshot tatt før pågående slider-drag — commit ved slipp gir ÉN undo per drag.
    @State private var dragSnapshot: SceneData?

    var body: some View {
        VStack(spacing: 0) {
            HStack {
                Text("Inspector")
                    .font(.system(size: 12, weight: .semibold))
                    .foregroundStyle(Theme.muted)
                    .textCase(.uppercase)
                    .kerning(0.5)
                Spacer()
            }
            .padding(.horizontal, 14)
            .padding(.vertical, 10)

            if let node = selectedNode {
                ScrollView {
                    VStack(alignment: .leading, spacing: 18) {
                        nodeHeader(node)
                        transformSection(node)
                        paramsSection(node)
                    }
                    .padding(14)
                }
            } else {
                Spacer()
                Text("Ingen valgt")
                    .font(.system(size: 13))
                    .foregroundStyle(Theme.muted)
                Spacer()
            }
        }
        .frame(width: 280)
        .background(Theme.surface)
    }

    private var selectedNode: Node? {
        document.selectedNodeId.flatMap { document.data.node($0) }
    }

    private func nodeHeader(_ node: Node) -> some View {
        HStack(spacing: 8) {
            Text(node.name)
                .font(.system(size: 14, weight: .semibold))
                .foregroundStyle(Theme.fg)
            Spacer()
            Text(node.kind.rawValue)
                .font(.system(size: 10, weight: .medium))
                .foregroundStyle(Theme.muted)
                .padding(.horizontal, 7)
                .padding(.vertical, 3)
                .background(Capsule().fill(Theme.raise))
        }
    }

    // MARK: - Transform

    private func transformSection(_ node: Node) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            InspectorSectionHeader(title: "Transform")
            vectorRow("Position", node.transform.position) { axis, v in
                document.updateNode(node.id) { $0.transform.position[axis] = v }
            }
            vectorRow("Rotation", node.transform.rotationEulerDeg) { axis, v in
                document.updateNode(node.id) { $0.transform.rotationEulerDeg[axis] = v }
            }
            vectorRow("Scale", node.transform.scale) { axis, v in
                document.updateNode(node.id) { $0.transform.scale[axis] = v }
            }
        }
    }

    private func vectorRow(_ label: String, _ vector: SIMD3<Float>,
                           onCommit: @escaping (Int, Float) -> Void) -> some View {
        VStack(alignment: .leading, spacing: 4) {
            Text(label)
                .font(.system(size: 12))
                .foregroundStyle(Theme.muted)
            HStack(spacing: 6) {
                NumericField(label: "X", value: vector.x) { onCommit(0, $0) }
                NumericField(label: "Y", value: vector.y) { onCommit(1, $0) }
                NumericField(label: "Z", value: vector.z) { onCommit(2, $0) }
            }
        }
    }

    // MARK: - Kind-spesifikke params

    @ViewBuilder
    private func paramsSection(_ node: Node) -> some View {
        switch node.params {
        case .light(let p): lightSection(node.id, p)
        case .camera(let p): cameraSection(node.id, p)
        case .talent(let p): talentSection(node.id, p)
        case .prop(let p): propSection(node.id, p)
        }
    }

    private func lightSection(_ id: String, _ p: LightParams) -> some View {
        VStack(alignment: .leading, spacing: 12) {
            InspectorSectionHeader(title: "Light")
            SegmentPicker(options: ["Spot", "Area"],
                          selection: p.type == .spot ? "Spot" : "Area") { sel in
                updateLight(id) { $0.type = sel == "Spot" ? .spot : .area }
            }
            slider("Intensity", "%", 0...100, p.intensity) { v, light in light.intensity = v }
            slider("Temp", "K", 2000...10000, p.temperatureK, step: 50) { v, light in light.temperatureK = v }
            slider("Beam", "°", 10...120, p.beamDeg) { v, light in light.beamDeg = v }
            Toggle(isOn: Binding(
                get: { p.castsShadows },
                set: { on in updateLight(id) { $0.castsShadows = on } }
            )) {
                Text("Shadows").font(.system(size: 12)).foregroundStyle(Theme.muted)
            }
            .tint(Theme.accent)
            SegmentPicker(options: ["Low", "Medium", "High"], selection: p.quality) { sel in
                updateLight(id) { $0.quality = sel }
            }
        }
    }

    private func cameraSection(_ id: String, _ p: CameraParams) -> some View {
        VStack(alignment: .leading, spacing: 12) {
            InspectorSectionHeader(title: "Camera")
            slider("Focal", "mm", 12...135, p.focalMm) { v, cam in cam.focalMm = v }
            slider("ISO", "", 100...6400, Double(p.iso), step: 50) { v, cam in cam.iso = Int(v) }
            textRow("Aperture", p.aperture) { v in updateCamera(id) { $0.aperture = v } }
            textRow("Shutter", p.shutter) { v in updateCamera(id) { $0.shutter = v } }
            Toggle(isOn: Binding(
                get: { p.dofEnabled },
                set: { on in updateCamera(id) { $0.dofEnabled = on } }
            )) {
                Text("Depth of Field").font(.system(size: 12)).foregroundStyle(Theme.muted)
            }
            .tint(Theme.accent)
        }
    }

    private func talentSection(_ id: String, _ p: TalentParams) -> some View {
        VStack(alignment: .leading, spacing: 12) {
            InspectorSectionHeader(title: "Talent")
            textRow("Seat", p.seat) { v in updateTalent(id) { $0.seat = v } }
            textRow("Marker", p.marker) { v in updateTalent(id) { $0.marker = v } }
            Toggle(isOn: Binding(
                get: { p.eyeline },
                set: { on in updateTalent(id) { $0.eyeline = on } }
            )) {
                Text("Eyeline").font(.system(size: 12)).foregroundStyle(Theme.muted)
            }
            .tint(Theme.accent)
        }
    }

    private func propSection(_ id: String, _ p: PropParams) -> some View {
        VStack(alignment: .leading, spacing: 12) {
            InspectorSectionHeader(title: "Prop")
            textRow("Material", p.material) { v in
                document.updateNode(id) {
                    if case .prop(var prop) = $0.params { prop.material = v; $0.params = .prop(prop) }
                }
            }
        }
    }

    // MARK: - Hjelpere

    /// Slider m/ transient mutasjon under drag + én undo-commit ved slipp.
    private func slider(_ label: String, _ unit: String, _ range: ClosedRange<Double>,
                        _ value: Double, step: Double = 1,
                        apply: @escaping (Double, inout LightParams) -> Void) -> ValueChipSlider {
        sliderGeneric(label, unit, range, value, step: step) { id, v in
            document.updateNodeTransient(id) {
                if case .light(var p) = $0.params { apply(v, &p); $0.params = .light(p) }
            }
        }
    }

    private func slider(_ label: String, _ unit: String, _ range: ClosedRange<Double>,
                        _ value: Double, step: Double = 1,
                        apply: @escaping (Double, inout CameraParams) -> Void) -> ValueChipSlider {
        sliderGeneric(label, unit, range, value, step: step) { id, v in
            document.updateNodeTransient(id) {
                if case .camera(var p) = $0.params { apply(v, &p); $0.params = .camera(p) }
            }
        }
    }

    private func sliderGeneric(_ label: String, _ unit: String, _ range: ClosedRange<Double>,
                               _ value: Double, step: Double,
                               transient: @escaping (String, Double) -> Void) -> ValueChipSlider {
        ValueChipSlider(label: label, unit: unit, range: range, step: step, value: value) { v in
            guard let id = document.selectedNodeId else { return }
            if dragSnapshot == nil { dragSnapshot = document.data }
            transient(id, v)
        } onCommit: {
            if let snapshot = dragSnapshot {
                document.commitTransient(from: snapshot)
                dragSnapshot = nil
            }
        }
    }

    private func textRow(_ label: String, _ value: String,
                         onCommit: @escaping (String) -> Void) -> some View {
        HStack {
            Text(label)
                .font(.system(size: 12))
                .foregroundStyle(Theme.muted)
            Spacer()
            TextField("", text: Binding(get: { value }, set: { _ in }))
                .font(Theme.mono(11))
                .foregroundStyle(Theme.fg)
                .multilineTextAlignment(.trailing)
                .frame(width: 130)
                .padding(.horizontal, 6)
                .padding(.vertical, 4)
                .background(RoundedRectangle(cornerRadius: 6).fill(Theme.raise))
                .overlay(RoundedRectangle(cornerRadius: 6).stroke(Theme.border, lineWidth: Theme.hairline))
                .onSubmit {}
                .disabled(true) // ponytail: strengfelt read-only i v1 — redigering via AI/fase 2
        }
    }

    private func updateLight(_ id: String, _ change: @escaping (inout LightParams) -> Void) {
        document.updateNode(id) {
            if case .light(var p) = $0.params { change(&p); $0.params = .light(p) }
        }
    }

    private func updateCamera(_ id: String, _ change: @escaping (inout CameraParams) -> Void) {
        document.updateNode(id) {
            if case .camera(var p) = $0.params { change(&p); $0.params = .camera(p) }
        }
    }

    private func updateTalent(_ id: String, _ change: @escaping (inout TalentParams) -> Void) {
        document.updateNode(id) {
            if case .talent(var p) = $0.params { change(&p); $0.params = .talent(p) }
        }
    }
}
