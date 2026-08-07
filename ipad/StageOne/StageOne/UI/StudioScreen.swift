import SwiftUI

struct StudioScreen: View {
    let document: SceneDocument
    let renderer: StageRenderer

    @State private var orbit: OrbitCamera = .default
    @State private var tool: EditorTool = .select
    @State private var lookThroughCameraId: String?

    var body: some View {
        HStack(spacing: 0) {
            HierarchyPanel(document: document)
            divider
            ViewportView(document: document, renderer: renderer,
                         orbit: $orbit, tool: $tool,
                         lookThroughCameraId: $lookThroughCameraId)
                .overlay(alignment: .topTrailing) { viewPresetPill }
                .overlay(alignment: .bottom) { toolPill.padding(.bottom, 12) }
            divider
            InspectorPanel(document: document)
        }
    }

    private var divider: some View {
        Rectangle().fill(Theme.border).frame(width: Theme.hairline)
    }

    private var viewPresetPill: some View {
        HStack(spacing: 2) {
            ForEach(ViewPreset.allCases, id: \.self) { preset in
                Button {
                    withAnimation(.easeInOut(duration: 0.35)) {
                        lookThroughCameraId = nil
                        orbit = .preset(preset)
                    }
                } label: {
                    Text(preset.rawValue.capitalized)
                        .font(.system(size: 11, weight: .medium))
                        .foregroundStyle(Theme.muted)
                        .padding(.horizontal, 9)
                        .padding(.vertical, 5)
                }
                .buttonStyle(.plain)
            }
        }
        .background(Capsule().fill(Theme.surface.opacity(0.85)))
        .overlay(Capsule().stroke(Theme.border, lineWidth: Theme.hairline))
        .padding(10)
    }

    private var toolPill: some View {
        HStack(spacing: 2) {
            ForEach(EditorTool.allCases, id: \.self) { t in
                Button {
                    tool = t
                } label: {
                    Image(systemName: icon(for: t))
                        .font(.system(size: 13, weight: .medium))
                        .foregroundStyle(tool == t ? Theme.fg : Theme.muted)
                        .frame(width: 34, height: 30)
                        .background(Capsule().fill(tool == t ? Theme.accent.opacity(0.35) : .clear))
                }
                .buttonStyle(.plain)
            }
        }
        .padding(3)
        .background(Capsule().fill(Theme.surface.opacity(0.85)))
        .overlay(Capsule().stroke(Theme.border, lineWidth: Theme.hairline))
    }

    private func icon(for tool: EditorTool) -> String {
        switch tool {
        case .select: "cursorarrow"
        case .move: "arrow.up.and.down.and.arrow.left.and.right"
        case .rotate: "arrow.trianglehead.2.clockwise.rotate.90"
        case .scale: "arrow.down.left.and.arrow.up.right"
        }
    }
}
