import SwiftUI

/// Multicam-switcher: kameraliste, program/preview-tiles, CUT/AUTO, detalj.
struct CamerasScreen: View {
    let document: SceneDocument
    let renderer: StageRenderer

    @State private var switcher = Switcher()
    @State private var dragSnapshot: SceneData?

    private var cameraNodes: [Node] { document.data.nodes.filter { $0.kind == .camera } }

    var body: some View {
        HStack(spacing: 0) {
            listPanel
            divider
            centerColumn
            divider
            detailPanel
        }
        .onAppear { switcher.ensureValid(in: document.data) }
        .onChange(of: document.data) { _, data in switcher.ensureValid(in: data) }
    }

    private var divider: some View {
        Rectangle().fill(Theme.border).frame(width: Theme.hairline)
    }

    // MARK: - Venstre: kameraliste

    private var listPanel: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 6) {
                InspectorSectionHeader(title: "Cameras")
                ForEach(cameraNodes) { node in
                    cameraRow(node)
                }
                Button {
                    addCamera()
                } label: {
                    Label("Add camera", systemImage: "plus")
                        .font(.system(size: 12, weight: .medium))
                        .foregroundStyle(Theme.fg)
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, 7)
                        .background(RoundedRectangle(cornerRadius: 8).fill(Theme.raise))
                        .overlay(RoundedRectangle(cornerRadius: 8).stroke(Theme.border, lineWidth: Theme.hairline))
                }
                .buttonStyle(.plain)
                .padding(.top, 6)
            }
            .padding(12)
        }
        .frame(width: 264)
        .background(Theme.surface)
    }

    @ViewBuilder
    private func cameraRow(_ node: Node) -> some View {
        if case .camera(let p) = node.params {
            let selected = document.selectedNodeId == node.id
            Button {
                document.selectedNodeId = node.id
            } label: {
                HStack(spacing: 8) {
                    Image(systemName: "video")
                        .font(.system(size: 12))
                        .foregroundStyle(selected ? Theme.accent : Theme.muted)
                    VStack(alignment: .leading, spacing: 1) {
                        Text(node.name)
                            .font(.system(size: 13))
                            .foregroundStyle(Theme.fg)
                        Text("\(Int(p.focalMm)) mm\(p.role.map { " · \($0)" } ?? "")")
                            .font(Theme.mono(9))
                            .foregroundStyle(Theme.muted)
                    }
                    Spacer()
                    if switcher.programId == node.id {
                        badge("PGM", color: .red)
                    } else if switcher.previewId == node.id {
                        badge("PVW", color: .green)
                    }
                }
                .padding(.horizontal, 8)
                .padding(.vertical, 6)
                .background(RoundedRectangle(cornerRadius: 8)
                    .fill(selected ? Theme.accent.opacity(0.14) : .clear))
            }
            .buttonStyle(.plain)
        }
    }

    private func badge(_ text: String, color: Color) -> some View {
        Text(text)
            .font(.system(size: 9, weight: .bold))
            .foregroundStyle(color)
            .padding(.horizontal, 5)
            .padding(.vertical, 2)
            .background(Capsule().fill(color.opacity(0.15)))
    }

    private func addCamera() {
        let id = "camera-\(UUID().uuidString.prefix(8).lowercased())"
        let count = cameraNodes.count + 1
        document.mutate { scene in
            scene.nodes.append(Node(
                id: id, name: "Camera \(count)", kind: .camera, enabled: true,
                transform: Transform(position: [0, 1.5, 4.5], rotationEulerDeg: [-3, 0, 0], scale: .one),
                params: .camera(CameraParams(focalMm: 35, aperture: "f/2.8", iso: 800,
                                             shutter: "1/50", dofEnabled: true, role: nil))
            ))
            if let i = scene.groups.firstIndex(where: { $0.id == "cameras" }) {
                scene.groups[i].childIds.append(id)
            }
        }
        document.selectedNodeId = id
    }

    // MARK: - Midten: program/preview + multicam + CUT/AUTO

    private var centerColumn: some View {
        VStack(spacing: 12) {
            HStack(spacing: 12) {
                programTile
                previewTile
            }
            .padding(.horizontal, 12)
            .padding(.top, 12)

            HStack {
                lensReadout
                Spacer()
                Button("CUT") { switcher.cut() }
                    .buttonStyle(SwitcherButtonStyle(prominent: false))
                Button("AUTO") { switcher.auto() }
                    .buttonStyle(SwitcherButtonStyle(prominent: true))
                    .disabled(switcher.isAutoTransitioning)
            }
            .padding(.horizontal, 12)

            multicamStrip
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .top)
        .background(Theme.bg)
    }

    @ViewBuilder
    private var programTile: some View {
        VStack(alignment: .leading, spacing: 6) {
            HStack {
                Text("Program")
                    .font(.system(size: 11, weight: .semibold))
                    .foregroundStyle(Theme.muted)
                Spacer()
                Text("ON AIR")
                    .font(.system(size: 9, weight: .bold))
                    .foregroundStyle(.red)
                    .padding(.horizontal, 6)
                    .padding(.vertical, 2)
                    .background(Capsule().fill(.red.opacity(0.15)))
            }
            ZStack {
                if let id = switcher.programId {
                    CameraTileView(document: document, renderer: renderer, cameraNodeId: id, fps: 60)
                }
                // AUTO-krysstoning: preview fader inn over program
                if switcher.isAutoTransitioning, let id = switcher.previewId {
                    CameraTileView(document: document, renderer: renderer, cameraNodeId: id, fps: 60)
                        .opacity(switcher.autoProgress)
                }
            }
            .aspectRatio(16 / 9, contentMode: .fit)
            .clipShape(RoundedRectangle(cornerRadius: 10))
            .overlay(RoundedRectangle(cornerRadius: 10).stroke(.red.opacity(0.7), lineWidth: 2))
        }
    }

    @ViewBuilder
    private var previewTile: some View {
        VStack(alignment: .leading, spacing: 6) {
            HStack {
                Text("Preview")
                    .font(.system(size: 11, weight: .semibold))
                    .foregroundStyle(Theme.muted)
                Spacer()
                Text("NEXT")
                    .font(.system(size: 9, weight: .bold))
                    .foregroundStyle(.green)
                    .padding(.horizontal, 6)
                    .padding(.vertical, 2)
                    .background(Capsule().fill(.green.opacity(0.15)))
            }
            ZStack {
                if let id = switcher.previewId {
                    CameraTileView(document: document, renderer: renderer, cameraNodeId: id, fps: 60)
                }
            }
            .aspectRatio(16 / 9, contentMode: .fit)
            .clipShape(RoundedRectangle(cornerRadius: 10))
            .overlay(RoundedRectangle(cornerRadius: 10).stroke(.green.opacity(0.6), lineWidth: 2))
        }
    }

    private var multicamStrip: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: 10) {
                ForEach(cameraNodes) { node in
                    multicamTile(node)
                }
            }
            .padding(.horizontal, 12)
            .padding(.bottom, 12)
        }
    }

    private func multicamTile(_ node: Node) -> some View {
        let isProgram = switcher.programId == node.id
        let isPreview = switcher.previewId == node.id
        return Button {
            switcher.setPreview(node.id)
            document.selectedNodeId = node.id
        } label: {
            VStack(spacing: 4) {
                CameraTileView(document: document, renderer: renderer, cameraNodeId: node.id, fps: 30)
                    .frame(width: 176, height: 99)
                    .clipShape(RoundedRectangle(cornerRadius: 8))
                    .overlay(RoundedRectangle(cornerRadius: 8)
                        .stroke(isProgram ? .red.opacity(0.8) : isPreview ? .green.opacity(0.7) : Theme.border,
                                lineWidth: isProgram || isPreview ? 2 : Theme.hairline))
                HStack {
                    Text(node.name.uppercased())
                        .font(Theme.mono(9))
                        .foregroundStyle(Theme.muted)
                    Spacer()
                    Text(isProgram ? "ON AIR" : isPreview ? "NEXT" : "")
                        .font(.system(size: 8, weight: .bold))
                        .foregroundStyle(isProgram ? .red : .green)
                }
                .frame(width: 176)
            }
        }
        .buttonStyle(.plain)
    }

    private var lensReadout: some View {
        SwiftUI.Group {
            if let id = switcher.programId, let node = document.data.node(id),
               case .camera(let p) = node.params {
                Text("\(Int(p.focalMm)) mm · \(p.aperture) · ISO \(p.iso) · \(p.shutter)")
                    .font(Theme.mono(11))
                    .foregroundStyle(Theme.muted)
            } else {
                Text("—").font(Theme.mono(11)).foregroundStyle(Theme.muted)
            }
        }
    }

    // MARK: - Høyre: detalj for valgt kamera

    private var detailPanel: some View {
        VStack(spacing: 0) {
            HStack {
                Text("Camera")
                    .font(.system(size: 12, weight: .semibold))
                    .foregroundStyle(Theme.muted)
                    .textCase(.uppercase)
                    .kerning(0.5)
                Spacer()
            }
            .padding(.horizontal, 14)
            .padding(.vertical, 10)

            if let node = selectedCamera, case .camera(let p) = node.params {
                ScrollView {
                    VStack(alignment: .leading, spacing: 14) {
                        Text(node.name)
                            .font(.system(size: 14, weight: .semibold))
                            .foregroundStyle(Theme.fg)
                        camSlider(node.id, "Focal Length", "mm", 14...135, p.focalMm) { v, cam in
                            cam.focalMm = v
                        }
                        camSlider(node.id, "ISO", "", 100...3200, Double(p.iso), step: 100) { v, cam in
                            cam.iso = Int(v)
                        }
                        VStack(alignment: .leading, spacing: 6) {
                            Text("Aperture").font(.system(size: 12)).foregroundStyle(Theme.muted)
                            SegmentPicker(options: ["f/1.4", "f/2.0", "f/2.8", "f/4.0"], selection: p.aperture) { sel in
                                updateCamera(node.id) { $0.aperture = sel }
                            }
                        }
                        VStack(alignment: .leading, spacing: 6) {
                            Text("Shutter").font(.system(size: 12)).foregroundStyle(Theme.muted)
                            SegmentPicker(options: ["1/25", "1/50", "1/100", "1/200"], selection: p.shutter) { sel in
                                updateCamera(node.id) { $0.shutter = sel }
                            }
                        }
                        Toggle(isOn: Binding(
                            get: { p.dofEnabled },
                            set: { on in updateCamera(node.id) { $0.dofEnabled = on } }
                        )) {
                            Text("Depth of Field").font(.system(size: 12)).foregroundStyle(Theme.muted)
                        }
                        .tint(Theme.accent)
                    }
                    .padding(14)
                }
            } else {
                Spacer()
                Text("Velg et kamera")
                    .font(.system(size: 13))
                    .foregroundStyle(Theme.muted)
                Spacer()
            }
        }
        .frame(width: 280)
        .background(Theme.surface)
    }

    private var selectedCamera: Node? {
        guard let id = document.selectedNodeId,
              let node = document.data.node(id), node.kind == .camera else {
            return switcher.programId.flatMap { document.data.node($0) }
        }
        return node
    }

    private func camSlider(_ nodeId: String, _ label: String, _ unit: String,
                           _ range: ClosedRange<Double>, _ value: Double, step: Double = 1,
                           apply: @escaping (Double, inout CameraParams) -> Void) -> ValueChipSlider {
        ValueChipSlider(label: label, unit: unit, range: range, step: step, value: value) { v in
            if dragSnapshot == nil { dragSnapshot = document.data }
            document.updateNodeTransient(nodeId) {
                if case .camera(var p) = $0.params { apply(v, &p); $0.params = .camera(p) }
            }
        } onCommit: {
            if let snapshot = dragSnapshot {
                document.commitTransient(from: snapshot)
                dragSnapshot = nil
            }
        }
    }

    private func updateCamera(_ id: String, _ change: @escaping (inout CameraParams) -> Void) {
        document.updateNode(id) {
            if case .camera(var p) = $0.params { change(&p); $0.params = .camera(p) }
        }
    }
}

struct SwitcherButtonStyle: ButtonStyle {
    let prominent: Bool

    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .font(.system(size: 13, weight: .bold))
            .foregroundStyle(prominent ? Theme.fg : Theme.muted)
            .padding(.horizontal, 22)
            .padding(.vertical, 9)
            .background(RoundedRectangle(cornerRadius: 9)
                .fill(prominent ? Theme.accent.opacity(configuration.isPressed ? 0.55 : 0.35) : Theme.raise))
            .overlay(RoundedRectangle(cornerRadius: 9)
                .stroke(prominent ? Theme.accent.opacity(0.6) : Theme.border, lineWidth: Theme.hairline))
    }
}
