import SwiftUI

struct StudioScreen: View {
    let document: SceneDocument
    let renderer: StageRenderer
    let sync: CloudSync

    @State private var aiOpen = false
    @State private var arOpen = false
    @State private var scanOpen = false

    @State private var orbit: OrbitCamera = .default
    @State private var tool: EditorTool = .select
    @State private var lookThroughCameraId: String?
    @State private var player = ShotPlayer()

    var body: some View {
        HStack(spacing: 0) {
            HierarchyPanel(document: document, onScanRoom: { scanOpen = true })
            divider
            VStack(spacing: 0) {
                ViewportView(document: document, renderer: renderer,
                             orbit: $orbit, tool: $tool,
                             lookThroughCameraId: $lookThroughCameraId)
                    .overlay(alignment: .topTrailing) { viewPresetPill }
                    .overlay(alignment: .bottom) { toolPill.padding(.bottom, 12) }
                    .overlay(alignment: .bottomLeading) { comingOverlays.padding(10) }
                Rectangle().fill(Theme.border).frame(height: Theme.hairline)
                TransportBar(document: document, player: player) { index in
                    player.jump(toShotIndex: index)
                    if !player.isPlaying {
                        lookThroughCameraId = document.data.shots[index].cameraNodeId
                    }
                }
            }
            divider
            InspectorPanel(document: document)
        }
        .onAppear { player.load(shots: document.data.shots) }
        .onChange(of: document.data.shots) { _, shots in player.load(shots: shots) }
        .onChange(of: player.isPlaying) { _, playing in
            lookThroughCameraId = playing ? player.currentCameraId(in: document.data) : nil
        }
        .onChange(of: player.elapsed) {
            if player.isPlaying {
                lookThroughCameraId = player.currentCameraId(in: document.data)
            }
        }
    }

    private var comingOverlays: some View {
        VStack(alignment: .leading, spacing: 6) {
            if aiOpen {
                AIAssistantPanel(document: document, sync: sync)
            }
            Button {
                withAnimation(.easeOut(duration: 0.15)) { aiOpen.toggle() }
            } label: {
                HStack(spacing: 6) {
                    Image(systemName: "sparkles")
                        .font(.system(size: 11))
                    Text("AI Assistant")
                        .font(.system(size: 11, weight: .medium))
                }
                .foregroundStyle(aiOpen ? Theme.fg : Theme.muted)
                .padding(.horizontal, 10)
                .padding(.vertical, 6)
                .background(Capsule().fill(aiOpen ? Theme.accent.opacity(0.35) : Theme.surface.opacity(0.85)))
                .overlay(Capsule().stroke(aiOpen ? Theme.accent.opacity(0.5) : Theme.border, lineWidth: Theme.hairline))
            }
            .buttonStyle(.plain)
            Button {
                arOpen = true
            } label: {
                HStack(spacing: 6) {
                    Image(systemName: "arkit")
                        .font(.system(size: 11))
                    Text("AR Preview")
                        .font(.system(size: 11, weight: .medium))
                }
                .foregroundStyle(Theme.muted)
                .padding(.horizontal, 10)
                .padding(.vertical, 6)
                .background(Capsule().fill(Theme.surface.opacity(0.85)))
                .overlay(Capsule().stroke(Theme.border, lineWidth: Theme.hairline))
            }
            .buttonStyle(.plain)
        }
        .fullScreenCover(isPresented: $arOpen) {
            ARPreviewSheet(document: document)
        }
        .fullScreenCover(isPresented: $scanOpen) {
            RoomScanSheet(document: document)
        }
    }

    private func comingChip(icon: String, label: String) -> some View {
        HStack(spacing: 6) {
            Image(systemName: icon)
                .font(.system(size: 11))
            Text(label)
                .font(.system(size: 11, weight: .medium))
            Text("Kommer")
                .font(.system(size: 9, weight: .semibold))
                .padding(.horizontal, 5)
                .padding(.vertical, 1)
                .background(Capsule().fill(Theme.raise))
        }
        .foregroundStyle(Theme.muted)
        .padding(.horizontal, 10)
        .padding(.vertical, 6)
        .background(Capsule().fill(Theme.surface.opacity(0.85)))
        .overlay(Capsule().stroke(Theme.border, lineWidth: Theme.hairline))
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
