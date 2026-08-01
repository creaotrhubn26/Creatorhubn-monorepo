import SwiftUI

/// Kvalitetssjekk-review (steg 4): kjør passet over hele serien og vis KUN de
/// flaggede bildene — lukkede øyne, uskarpt ansikt, utbrent motiv — så fotografen
/// vurderer noen titalls i stedet for alle 800. Trykk en rad → hopp til bildet.
struct QualityReviewSheet: View {
    @Bindable var model: RedigeringModel
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        NavigationStack {
            Group {
                if model.qualityRunning {
                    running
                } else if model.qualityFindings.isEmpty {
                    clean
                } else {
                    list
                }
            }
            .frame(maxWidth: .infinity, maxHeight: .infinity)
            .background(CHTheme.bg.ignoresSafeArea())
            .navigationTitle("Kvalitetssjekk")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarLeading) {
                    Button("Lukk") { dismiss() }
                }
                ToolbarItem(placement: .topBarTrailing) {
                    Button {
                        Task { await model.runQualityCheck() }
                    } label: { Image(systemName: "arrow.clockwise") }
                        .disabled(model.qualityRunning)
                }
            }
        }
        .task { if !model.qualityDidRun { await model.runQualityCheck() } }
    }

    // MARK: - Kjører

    private var running: some View {
        VStack(spacing: 14) {
            ProgressView(value: Double(model.qualityProgress), total: Double(max(1, model.qualityTotal)))
                .tint(CHTheme.accent).frame(width: 220)
            Text("Analyserer \(model.qualityProgress)/\(model.qualityTotal) bilder…")
                .font(.subheadline).foregroundStyle(CHTheme.textSecondary)
            Text("Ansikter, øyne, fokus og motiv-klipping måles én gang per bilde.")
                .font(.caption).foregroundStyle(CHTheme.textMuted)
        }
    }

    // MARK: - Ren serie

    private var clean: some View {
        ContentUnavailableView {
            Label("Ingen leveranse-blokkere", systemImage: "checkmark.seal.fill")
        } description: {
            Text("Kvalitetssjekken fant ingen lukkede øyne, uskarpe ansikter eller utbrente motiv i de \(model.qualityTotal) bildene.")
        }
    }

    // MARK: - Funn-liste

    private var list: some View {
        VStack(spacing: 0) {
            summaryBar
            List {
                ForEach(model.qualityFindings) { finding in
                    Button {
                        model.selectFinding(finding)
                        dismiss()
                    } label: { row(finding) }
                        .listRowBackground(CHTheme.surface)
                }
            }
            .listStyle(.plain)
            .scrollContentBackground(.hidden)
        }
    }

    private var summaryBar: some View {
        HStack(spacing: 14) {
            if model.qualityBlockerCount > 0 {
                summaryChip("\(model.qualityBlockerCount) blokkere", color: Color(hex: 0xE0606A))
            }
            if model.qualityWarningCount > 0 {
                summaryChip("\(model.qualityWarningCount) svake", color: .orange)
            }
            Spacer()
            Text("av \(model.qualityTotal) bilder").font(.caption).foregroundStyle(CHTheme.textMuted)
        }
        .padding(.horizontal, 16).padding(.vertical, 10)
    }

    private func summaryChip(_ text: String, color: Color) -> some View {
        Text(text).font(.caption.weight(.semibold)).foregroundStyle(.white)
            .padding(.horizontal, 10).padding(.vertical, 5)
            .background(color.opacity(0.9), in: Capsule())
    }

    private func row(_ finding: QualityFinding) -> some View {
        let asset = model.assets.first { $0.id == finding.assetId }
        return HStack(spacing: 12) {
            thumb(asset)
            VStack(alignment: .leading, spacing: 6) {
                Text(asset?.originalFilename ?? "Bilde")
                    .font(.subheadline.weight(.medium)).foregroundStyle(CHTheme.textPrimary)
                    .lineLimit(1)
                FlowChips(issues: finding.issues)
            }
            Spacer()
            Image(systemName: "chevron.right").font(.caption).foregroundStyle(CHTheme.textMuted)
        }
        .padding(.vertical, 4)
    }

    @ViewBuilder
    private func thumb(_ asset: Asset?) -> some View {
        Group {
            if let path = asset?.displayPreviewKey, let ui = UIImage(contentsOfFile: path) {
                Image(uiImage: ui).resizable().scaledToFill()
            } else {
                ZStack { CHTheme.surfaceElevated; Image(systemName: "photo").foregroundStyle(CHTheme.textMuted) }
            }
        }
        .frame(width: 60, height: 60).clipShape(RoundedRectangle(cornerRadius: 8))
    }
}

/// Kompakte funn-chips (én per problem) — blokkere i rødt, svakheter i oransje.
private struct FlowChips: View {
    let issues: [QualityIssue]

    var body: some View {
        HStack(spacing: 6) {
            ForEach(issues) { issue in
                HStack(spacing: 4) {
                    Image(systemName: issue.icon).font(.system(size: 9, weight: .bold))
                    Text(issue.label).font(.caption2.weight(.semibold))
                }
                .foregroundStyle(.white)
                .padding(.horizontal, 7).padding(.vertical, 3)
                .background((issue.severity == .blocker ? Color(hex: 0xE0606A) : Color.orange).opacity(0.9),
                           in: Capsule())
            }
        }
    }
}
