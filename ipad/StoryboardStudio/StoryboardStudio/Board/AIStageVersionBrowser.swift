import SwiftUI

struct AIStageVersionBrowser: View {
    let versions: [StoryboardAIImageVersionSummary]
    let currentFramingFingerprint: String
    let onApprove: (StoryboardAIImageVersionSummary) -> Void
    @Environment(\.dismiss) private var dismiss
    @State private var selectedStage = "all"
    @State private var selectedVersionID: String?

    private var filtered: [StoryboardAIImageVersionSummary] {
        let ordered = versions.sorted { $0.createdAt > $1.createdAt }
        return selectedStage == "all" ? ordered : ordered.filter { $0.stage == selectedStage }
    }

    private var selected: StoryboardAIImageVersionSummary? {
        filtered.first { $0.id == selectedVersionID } ?? filtered.first
    }

    private func matchesCurrentFraming(_ version: StoryboardAIImageVersionSummary) -> Bool {
        version.framingFingerprint == currentFramingFingerprint
    }

    var body: some View {
        NavigationSplitView {
            List(selection: $selectedVersionID) {
                Picker("Steg", selection: $selectedStage) {
                    Text("Alle").tag("all")
                    Text("Pencil").tag("pencil")
                    Text("Color").tag("color")
                    Text("Atmosphere").tag("atmosphere")
                }
                .pickerStyle(.segmented)
                ForEach(filtered) { version in
                    HStack(spacing: 10) {
                        versionImage(version)
                            .frame(width: 68, height: 44).clipped()
                            .clipShape(RoundedRectangle(cornerRadius: 6))
                        VStack(alignment: .leading, spacing: 3) {
                            Text(version.stage.capitalized).font(.subheadline.weight(.semibold))
                            Text(version.model ?? "Original source")
                                .font(.caption2).foregroundStyle(.secondary).lineLimit(1)
                        }
                        Spacer()
                        if version.isApproved {
                            Image(systemName: "checkmark.seal.fill").foregroundStyle(.green)
                        } else if version.stage != "pencil" && !matchesCurrentFraming(version) {
                            Image(systemName: "clock.arrow.circlepath")
                                .foregroundStyle(.orange)
                                .accessibilityLabel("Eldre utsnitt")
                        }
                    }
                    .tag(version.id)
                    .frame(minHeight: 52)
                }
            }
            .navigationTitle("AI-versjoner")
        } detail: {
            if let selected {
                ScrollView {
                    VStack(alignment: .leading, spacing: 16) {
                        versionImage(selected)
                            .scaledToFit()
                            .frame(maxWidth: .infinity)
                            .background(Color(uiColor: .secondarySystemBackground),
                                        in: RoundedRectangle(cornerRadius: 14))
                        HStack {
                            Label(selected.stage.capitalized,
                                  systemImage: selected.isApproved ? "checkmark.seal.fill" : "sparkles")
                            Spacer()
                            Text(selected.quality ?? "").foregroundStyle(.secondary)
                        }
                        .font(.headline)
                        LabeledContent("Modell", value: selected.model ?? "Original")
                        LabeledContent("Opprettet", value: selected.createdAt)
                        if let fingerprint = selected.compilationFingerprint {
                            LabeledContent("Prompt fingerprint",
                                           value: String(fingerprint.prefix(12)) + "…")
                        }
                        if !selected.isApproved && selected.stage != "pencil"
                            && matchesCurrentFraming(selected) {
                            Button {
                                onApprove(selected)
                                dismiss()
                            } label: {
                                Label("Godkjenn som \(selected.stage.capitalized)-master",
                                      systemImage: "checkmark.seal.fill")
                                    .frame(maxWidth: .infinity, minHeight: 48)
                            }
                            .buttonStyle(.borderedProminent)
                        } else if selected.stage != "pencil"
                            && !matchesCurrentFraming(selected) {
                            Label("Kandidaten tilhører et eldre kamerautsnitt og kan ikke godkjennes.",
                                  systemImage: "exclamationmark.triangle.fill")
                                .font(.callout)
                                .foregroundStyle(.orange)
                        }
                        Text("Godkjenning endrer aldri Pencil-kilden. Nye genereringer opprettes som egne versjoner.")
                            .font(.caption).foregroundStyle(.secondary)
                    }
                    .padding(22)
                }
                .navigationTitle("Version detail")
            } else {
                ContentUnavailableView("Ingen versjoner", systemImage: "photo.stack")
            }
        }
        .toolbar {
            ToolbarItem(placement: .topBarTrailing) { Button("Ferdig") { dismiss() } }
        }
        .onAppear { selectedVersionID = filtered.first?.id }
        .onChange(of: selectedStage) { selectedVersionID = filtered.first?.id }
    }

    @ViewBuilder
    private func versionImage(_ version: StoryboardAIImageVersionSummary) -> some View {
        if let image = decode(version.imageData) {
            Image(uiImage: image).resizable().interpolation(.high).scaledToFill()
        } else {
            ZStack {
                Color(uiColor: .secondarySystemBackground)
                Image(systemName: "photo").foregroundStyle(.secondary)
            }
        }
    }

    private func decode(_ value: String) -> UIImage? {
        guard let comma = value.firstIndex(of: ","), value.hasPrefix("data:"),
              let data = Data(base64Encoded: String(value[value.index(after: comma)...]))
        else { return nil }
        return UIImage(data: data)
    }
}
