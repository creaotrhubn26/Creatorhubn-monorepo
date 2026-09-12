// AnnotationToolbar.swift
//
// Flytende verktøy-rad for annotasjon-modus. Velg type, farge, og
// hvem strøket skal tildeles. Lagre / avbryt.

import SwiftUI

@MainActor
final class AnnotationDraftStore: ObservableObject {
    @Published var isDrawing = false
    @Published var selectedType: AnnotationType = .freehand
    @Published var selectedColorHex: String = "c084fc"
    @Published var strokeWidth: Double = 4.0
    @Published var assignedToUserId: String?
    @Published var title: String = ""
    @Published var body: String = ""
    @Published var pendingCoordinates: [CoordPair] = []

    struct CoordPair: Sendable {
        let lat: Double
        let lng: Double
    }

    var hasPendingDraft: Bool { !pendingCoordinates.isEmpty }

    func reset() {
        isDrawing = false
        title = ""
        body = ""
        assignedToUserId = nil
        pendingCoordinates = []
    }
}

struct AnnotationToolbar: View {
    @ObservedObject var store: AnnotationDraftStore
    let canCreate: Bool
    let members: [MemberProfile]
    let onSave: () async -> Void
    @State private var showAssignSheet = false

    private let palette: [String] = ["c084fc", "f97316", "fbbf24", "34d399", "60a5fa", "f87171"]

    var body: some View {
        VStack(spacing: 0) {
            mainRow
            if store.hasPendingDraft {
                Divider().background(Color.white.opacity(0.2))
                draftSummary
            }
        }
        .background(.ultraThinMaterial)
        .clipShape(RoundedRectangle(cornerRadius: 14))
        .shadow(color: .black.opacity(0.4), radius: 12, y: 4)
    }

    private var mainRow: some View {
        HStack(spacing: 10) {
            // Type-picker
            Menu {
                ForEach(AnnotationType.allCases, id: \.self) { t in
                    Button {
                        store.selectedType = t
                    } label: {
                        Label(t.label, systemImage: t.iconName)
                    }
                }
            } label: {
                Label(store.selectedType.label, systemImage: store.selectedType.iconName)
                    .font(.caption.bold())
                    .padding(.horizontal, 10).padding(.vertical, 6)
                    .background(Color(hex: store.selectedColorHex).opacity(0.25), in: Capsule())
                    .foregroundStyle(.white)
            }

            // Farger
            ForEach(palette, id: \.self) { hex in
                Circle()
                    .fill(Color(hex: hex))
                    .frame(width: store.selectedColorHex == hex ? 22 : 18,
                           height: store.selectedColorHex == hex ? 22 : 18)
                    .overlay(
                        Circle().stroke(
                            store.selectedColorHex == hex ? Color.white : Color.clear,
                            lineWidth: 2
                        )
                    )
                    .onTapGesture { store.selectedColorHex = hex }
                    .accessibilityLabel("Farge \(hex)")
            }

            Spacer()

            if canCreate {
                Toggle(isOn: $store.isDrawing) {
                    Label(store.isDrawing ? "Tegner" : "Tegn",
                          systemImage: "pencil.tip.crop.circle")
                        .font(.caption.bold())
                }
                .toggleStyle(.button)
                .tint(Color(hex: store.selectedColorHex))
            }
        }
        .padding(10)
    }

    private var draftSummary: some View {
        VStack(spacing: 8) {
            TextField("Tittel (valgfri)", text: $store.title)
                .textFieldStyle(.roundedBorder)
            TextField("Notat (valgfri)", text: $store.body, axis: .vertical)
                .textFieldStyle(.roundedBorder)
                .lineLimit(2)
            HStack {
                // Tildel til selger
                Menu {
                    Button("Synlig for alle") {
                        store.assignedToUserId = nil
                    }
                    ForEach(members.filter { ["salgskonsulent","promotor"].contains($0.role) }) { m in
                        Button(m.displayName ?? m.userEmail ?? m.userId) {
                            store.assignedToUserId = m.userId
                        }
                    }
                } label: {
                    HStack(spacing: 4) {
                        Image(systemName: "person.fill")
                            .font(.caption2)
                        Text(assigneeLabel)
                            .font(.caption)
                    }
                    .padding(.horizontal, 8).padding(.vertical, 4)
                    .background(.white.opacity(0.1), in: Capsule())
                    .foregroundStyle(.white)
                }

                Spacer()

                Button("Avbryt") { store.reset() }
                    .font(.caption)
                    .foregroundStyle(.secondary)

                Button {
                    Task { await onSave() }
                } label: {
                    Label("Lagre", systemImage: "checkmark")
                        .font(.caption.bold())
                }
                .buttonStyle(.borderedProminent)
                .tint(Color(hex: store.selectedColorHex))
            }
        }
        .padding(10)
    }

    private var assigneeLabel: String {
        guard let uid = store.assignedToUserId else { return "For alle" }
        if let m = members.first(where: { $0.userId == uid }) {
            return m.displayName ?? m.userEmail ?? "Selger"
        }
        return "Selger"
    }
}

private extension Color {
    init(hex: String) {
        let s = hex.trimmingCharacters(in: CharacterSet.alphanumerics.inverted)
        var rgb: UInt64 = 0
        Scanner(string: s).scanHexInt64(&rgb)
        self.init(
            red: Double((rgb >> 16) & 0xFF) / 255,
            green: Double((rgb >> 8) & 0xFF) / 255,
            blue: Double(rgb & 0xFF) / 255
        )
    }
}
