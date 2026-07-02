// PondusVisionWindow.swift
//
// 2D-vindu for Pondus på Vision Pro. Template-picker + score-oversikt +
// «Åpne coach»-knapp som starter ImmersiveSpace-en.

import SwiftUI

struct PondusVisionWindow: View {
    @Environment(VisionPondusStore.self) private var store
    @Environment(\.openImmersiveSpace) private var openImmersiveSpace
    @Environment(\.dismissImmersiveSpace) private var dismissImmersiveSpace
    @State private var immersiveOpen = false

    var body: some View {
        NavigationSplitView {
            List(store.templates, selection: bindingForSelection()) { template in
                templateRow(template)
                    .tag(template as VisionPondusTemplate?)
            }
            .navigationTitle("Pondus")
        } detail: {
            if let active = store.activeTemplate {
                detail(for: active)
            } else {
                ContentUnavailableView(
                    "Velg en pondus-mal",
                    systemImage: "book.pages.fill",
                    description: Text("Bla i listen til venstre for å komme i gang.")
                )
            }
        }
    }

    // Binding-hjelper — Observation trenger @Bindable, som ikke fungerer
    // rett på selection her. Vi bygger manuell binding.
    private func bindingForSelection() -> Binding<VisionPondusTemplate?> {
        Binding(
            get: { store.activeTemplate },
            set: { store.activeTemplate = $0 }
        )
    }

    @ViewBuilder
    private func templateRow(_ t: VisionPondusTemplate) -> some View {
        HStack(spacing: 12) {
            Image(systemName: iconForKind(t.kind))
                .font(.title3)
                .foregroundStyle(.tint)
                .frame(width: 32)
            VStack(alignment: .leading, spacing: 2) {
                Text(t.name).font(.headline)
                Text("\(t.kindLabel) · Score \(t.score)")
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }
        }
        .padding(.vertical, 4)
    }

    @ViewBuilder
    private func detail(for template: VisionPondusTemplate) -> some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 24) {
                headerBlock(template)
                analysisBlock(template.analysis)
                stepsBlock(template.orderedSteps)
                coachActionRow()
            }
            .padding(28)
        }
        .navigationTitle(template.name)
    }

    @ViewBuilder
    private func headerBlock(_ t: VisionPondusTemplate) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            Text(t.name).font(.largeTitle.bold())
            HStack(spacing: 12) {
                Label(t.kindLabel, systemImage: iconForKind(t.kind))
                    .font(.headline)
                    .foregroundStyle(.secondary)
                Text("Score \(t.score)")
                    .font(.headline.monospacedDigit())
                    .foregroundStyle(scoreColor(t.score))
            }
        }
    }

    @ViewBuilder
    private func analysisBlock(_ a: VisionPondusAnalysis) -> some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("Pondus-analyse")
                .font(.title3.bold())
            VStack(spacing: 8) {
                ForEach(VisionPondusAxis.axes(from: a)) { axis in
                    axisRow(axis)
                }
            }
            .padding(.vertical, 4)
        }
        .padding(20)
        .background(.regularMaterial, in: RoundedRectangle(cornerRadius: 20))
    }

    @ViewBuilder
    private func axisRow(_ axis: VisionPondusAxis) -> some View {
        HStack(spacing: 12) {
            Text(axis.label).frame(width: 130, alignment: .leading).font(.body)
            GeometryReader { geo in
                ZStack(alignment: .leading) {
                    Capsule().fill(axis.tint.opacity(0.15))
                    Capsule()
                        .fill(axis.tint)
                        .frame(width: geo.size.width * CGFloat(axis.value) / 100)
                }
            }
            .frame(height: 10)
            Text("\(axis.value)").font(.body.monospacedDigit()).frame(width: 40, alignment: .trailing)
        }
    }

    @ViewBuilder
    private func stepsBlock(_ steps: [VisionPondusStep]) -> some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("Steg (\(steps.count))")
                .font(.title3.bold())
            VStack(spacing: 10) {
                ForEach(steps) { step in
                    HStack(alignment: .top, spacing: 12) {
                        Image(systemName: step.icon ?? "circle.fill")
                            .font(.title3)
                            .foregroundStyle(.tint)
                            .frame(width: 32)
                        VStack(alignment: .leading, spacing: 2) {
                            Text(step.title).font(.headline)
                            if let prompt = step.prompt, !prompt.isEmpty {
                                Text(prompt)
                                    .font(.body)
                                    .foregroundStyle(.secondary)
                            }
                        }
                    }
                    .padding(12)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .background(.thinMaterial, in: RoundedRectangle(cornerRadius: 14))
                }
            }
        }
    }

    @ViewBuilder
    private func coachActionRow() -> some View {
        HStack {
            Spacer()
            Button {
                Task {
                    if immersiveOpen {
                        await dismissImmersiveSpace()
                        immersiveOpen = false
                    } else {
                        let result = await openImmersiveSpace(id: "PondusCoach")
                        if case .opened = result { immersiveOpen = true }
                    }
                }
            } label: {
                Label(
                    immersiveOpen ? "Lukk spatial coach" : "Åpne spatial coach",
                    systemImage: immersiveOpen ? "xmark.circle.fill" : "sparkles"
                )
                .font(.title3.bold())
                .padding(.horizontal, 20).padding(.vertical, 14)
            }
            .buttonStyle(.borderedProminent)
            .controlSize(.large)
        }
    }

    // Helpers
    private func iconForKind(_ kind: String) -> String {
        switch kind {
        case "telephone": return "phone.fill"
        case "video":     return "video.fill"
        case "email":     return "envelope.fill"
        case "meeting":   return "calendar"
        case "field":     return "figure.walk"
        default:          return "doc.text.fill"
        }
    }

    private func scoreColor(_ s: Int) -> Color {
        if s >= 85 { return .green }
        if s >= 70 { return .orange }
        return .yellow
    }
}
