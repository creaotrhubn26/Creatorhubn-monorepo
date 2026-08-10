import SwiftUI

struct HierarchyPanel: View {
    let document: SceneDocument
    var onScanRoom: (() -> Void)? = nil

    var body: some View {
        VStack(spacing: 0) {
            header
            ScrollView {
                VStack(alignment: .leading, spacing: 2) {
                    ForEach(document.data.groups) { group in
                        groupSection(group)
                    }
                }
                .padding(.horizontal, 8)
                .padding(.vertical, 6)
            }
            Spacer(minLength: 0)
            comingSoonCards
        }
        .frame(width: 264)
        .background(Theme.surface)
    }

    private var header: some View {
        HStack {
            Text("Hierarchy")
                .font(.system(size: 12, weight: .semibold))
                .foregroundStyle(Theme.muted)
                .textCase(.uppercase)
                .kerning(0.5)
            Spacer()
        }
        .padding(.horizontal, 14)
        .padding(.vertical, 10)
    }

    private func groupSection(_ group: Group) -> some View {
        VStack(alignment: .leading, spacing: 1) {
            Text(group.name)
                .font(.system(size: 11, weight: .semibold))
                .foregroundStyle(Theme.muted)
                .padding(.horizontal, 8)
                .padding(.top, 8)
                .padding(.bottom, 3)
            ForEach(group.childIds, id: \.self) { childId in
                if let node = document.data.node(childId) {
                    nodeRow(node)
                }
            }
        }
    }

    private func nodeRow(_ node: Node) -> some View {
        let selected = document.selectedNodeId == node.id
        return HStack(spacing: 8) {
            Image(systemName: icon(for: node.kind))
                .font(.system(size: 12))
                .foregroundStyle(selected ? Theme.accent : Theme.muted)
                .frame(width: 16)
            Text(node.name)
                .font(.system(size: 13))
                .foregroundStyle(node.enabled ? Theme.fg : Theme.muted)
                .lineLimit(1)
            Spacer()
            Button {
                document.updateNode(node.id) { $0.enabled.toggle() }
            } label: {
                Image(systemName: node.enabled ? "eye" : "eye.slash")
                    .font(.system(size: 11))
                    .foregroundStyle(Theme.muted)
            }
            .buttonStyle(.plain)
        }
        .padding(.horizontal, 8)
        .padding(.vertical, 5)
        .background(RoundedRectangle(cornerRadius: 8)
            .fill(selected ? Theme.accent.opacity(0.14) : .clear))
        .contentShape(Rectangle())
        .onTapGesture {
            document.selectedNodeId = node.id
        }
    }

    private func icon(for kind: NodeKind) -> String {
        switch kind {
        case .light: "lightbulb"
        case .camera: "video"
        case .talent: "person"
        case .prop: "cube"
        }
    }

    private var comingSoonCards: some View {
        VStack(spacing: 8) {
            panelCard(icon: "viewfinder", title: "Scan Room", subtitle: "LiDAR", action: onScanRoom)
            panelCard(icon: "square.grid.2x2", title: "Assets", subtitle: "Bibliotek")
        }
        .padding(10)
    }

    /// Panelkort: med `action` = aktivt (accent-ikon + chevron), uten = «Kommer».
    private func panelCard(icon: String, title: String, subtitle: String,
                           action: (() -> Void)? = nil) -> some View {
        Button {
            action?()
        } label: {
            HStack(spacing: 10) {
                Image(systemName: icon)
                    .font(.system(size: 14))
                    .foregroundStyle(action != nil ? Theme.accent : Theme.muted)
                VStack(alignment: .leading, spacing: 1) {
                    Text(title)
                        .font(.system(size: 12, weight: .medium))
                        .foregroundStyle(action != nil ? Theme.fg : Theme.muted)
                    Text(subtitle)
                        .font(.system(size: 10))
                        .foregroundStyle(Theme.muted.opacity(0.7))
                }
                Spacer()
                if action != nil {
                    Image(systemName: "chevron.right")
                        .font(.system(size: 10))
                        .foregroundStyle(Theme.muted)
                } else {
                    Text("Kommer")
                        .font(.system(size: 9, weight: .semibold))
                        .foregroundStyle(Theme.muted)
                        .padding(.horizontal, 6)
                        .padding(.vertical, 2)
                        .background(Capsule().fill(Theme.raise))
                }
            }
            .padding(10)
            .background(RoundedRectangle(cornerRadius: 10).fill(Theme.bg.opacity(0.5)))
            .overlay(RoundedRectangle(cornerRadius: 10).stroke(Theme.border, lineWidth: Theme.hairline))
        }
        .buttonStyle(.plain)
        .disabled(action == nil)
    }
}
