import SwiftUI

struct TopToolbar: View {
    let document: SceneDocument
    @Binding var mode: AppMode
    var accountSymbol: String = "person.crop.circle"
    var onAccountTap: () -> Void = {}

    var body: some View {
        HStack(spacing: 14) {
            Text("StageOne")
                .font(.system(size: 15, weight: .semibold))
                .foregroundStyle(Theme.fg)

            HStack(spacing: 2) {
                iconButton("arrow.uturn.backward", enabled: document.undoManager.canUndo) {
                    document.undoManager.undo()
                }
                iconButton("arrow.uturn.forward", enabled: document.undoManager.canRedo) {
                    document.undoManager.redo()
                }
            }

            Spacer()

            HStack(spacing: 4) {
                ForEach(AppMode.allCases, id: \.self) { m in
                    Button {
                        mode = m
                    } label: {
                        Text(m.rawValue)
                            .font(.system(size: 13, weight: mode == m ? .semibold : .regular))
                            .foregroundStyle(mode == m ? Theme.fg : Theme.muted)
                            .padding(.horizontal, 14)
                            .padding(.vertical, 6)
                            .background(
                                Capsule().fill(mode == m ? Theme.accent.opacity(0.35) : .clear)
                            )
                    }
                    .buttonStyle(.plain)
                }
            }
            .padding(3)
            .background(Capsule().fill(Theme.surface))
            .overlay(Capsule().stroke(Theme.border, lineWidth: Theme.hairline))

            Spacer()

            Menu {
                Button("Add Box") { addProp(.box) }
                Button("Add Cylinder") { addProp(.cylinder) }
                Button("Add Capsule") { addProp(.capsule) }
            } label: {
                Image(systemName: "plus")
                    .font(.system(size: 14, weight: .medium))
                    .foregroundStyle(Theme.fg)
                    .frame(width: 30, height: 30)
                    .background(Circle().fill(Theme.surface))
                    .overlay(Circle().stroke(Theme.border, lineWidth: Theme.hairline))
            }

            Button(action: onAccountTap) {
                Image(systemName: accountSymbol)
                    .font(.system(size: 15, weight: .medium))
                    .foregroundStyle(Theme.fg)
                    .frame(width: 30, height: 30)
                    .background(Circle().fill(Theme.surface))
                    .overlay(Circle().stroke(Theme.border, lineWidth: Theme.hairline))
            }
            .buttonStyle(.plain)
        }
        .padding(.horizontal, 14)
        .padding(.vertical, 8)
        .background(Theme.bg)
    }

    private func iconButton(_ symbol: String, enabled: Bool, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            Image(systemName: symbol)
                .font(.system(size: 13, weight: .medium))
                .foregroundStyle(enabled ? Theme.fg : Theme.muted.opacity(0.5))
                .frame(width: 28, height: 28)
        }
        .buttonStyle(.plain)
        .disabled(!enabled)
    }

    private func addProp(_ shape: PropShape) {
        let id = "prop-\(UUID().uuidString.prefix(8).lowercased())"
        document.mutate { scene in
            scene.nodes.append(Node(
                id: id,
                name: "New \(shape.rawValue.capitalized)",
                kind: .prop,
                enabled: true,
                transform: Transform(position: [0, 0.5, 1.5], rotationEulerDeg: .zero, scale: .one),
                params: .prop(PropParams(material: "Matte Charcoal", shape: shape))
            ))
            if let i = scene.groups.firstIndex(where: { $0.id == "studio" }) {
                scene.groups[i].childIds.append(id)
            }
        }
        document.selectedNodeId = id
    }
}
