import SwiftUI

struct StoryboardReadiness: Equatable, Sendable {
    struct Check: Identifiable, Equatable, Sendable {
        let id: String
        let label: String
        let complete: Bool
    }

    let checks: [Check]
    var completed: Int { checks.filter(\.complete).count }
    var total: Int { checks.count }
    var progress: Double { total == 0 ? 0 : Double(completed) / Double(total) }
    var missing: [String] { checks.filter { !$0.complete }.map(\.label) }

    static func frame(_ frame: FrameSummary) -> StoryboardReadiness {
        StoryboardReadiness(checks: [
            .init(id: "visual", label: "Tegning eller bilde", complete: hasVisual(frame)),
            .init(id: "action", label: "Handling/dialog", complete: !frame.description.trimmed.isEmpty),
            .init(id: "beat", label: "Story beat", complete: !(frame.beatTag ?? "").trimmed.isEmpty),
            .init(id: "shot", label: "Shot size", complete: !(frame.shotType ?? "").trimmed.isEmpty),
            .init(id: "lens", label: "Linse", complete: frame.lensMm != nil),
            .init(id: "movement", label: "Kamerabevegelse", complete: !(frame.movement ?? "").trimmed.isEmpty),
            .init(id: "duration", label: "Timing", complete: frame.durationSec > 0),
            .init(id: "context", label: "Scenario / production context",
                  complete: frame.scenarioPackId != nil || frame.setLocation != nil),
        ])
    }

    static func hasVisual(_ frame: FrameSummary) -> Bool {
        if !(frame.imageUrl ?? "").isEmpty { return true }
        let strokes = (frame.strokesJSON ?? "[]").trimmingCharacters(in: .whitespacesAndNewlines)
        return strokes != "[]" && !strokes.isEmpty
    }
}

struct StoryboardContinuityIssue: Identifiable, Equatable, Sendable {
    let id: String
    let severity: Severity
    let sceneIndex: Int
    let frameIndex: Int
    let title: String
    let detail: String

    enum Severity: String, Sendable {
        case note, warning
        var symbol: String { self == .warning ? "exclamationmark.triangle.fill" : "info.circle.fill" }
        var color: Color { self == .warning ? .orange : .blue }
    }
}

enum StoryboardProductionAnalysis {
    static func continuityIssues(scenes: [SceneSummary]) -> [StoryboardContinuityIssue] {
        var issues: [StoryboardContinuityIssue] = []
        for (sceneIndex, scene) in scenes.enumerated() {
            for frameIndex in scene.frames.indices where frameIndex > 0 {
                let previous = scene.frames[frameIndex - 1]
                let frame = scene.frames[frameIndex]
                func compare(_ lhs: String?, _ rhs: String?, label: String) {
                    guard let lhs, let rhs, !lhs.isEmpty, !rhs.isEmpty, lhs != rhs else { return }
                    issues.append(.init(
                        id: "\(scene.id)-\(frame.id)-\(label)", severity: .note,
                        sceneIndex: sceneIndex, frameIndex: frameIndex,
                        title: "\(label) endres ved shot \(frame.shotNumber)",
                        detail: "\(previous.shotNumber): \(lhs) → \(frame.shotNumber): \(rhs). Bekreft at endringen er bevisst."))
                }
                compare(previous.timeOfDay, frame.timeOfDay, label: "Tid på døgnet")
                compare(previous.weather, frame.weather, label: "Vær")
                compare(previous.setLocation, frame.setLocation, label: "Location")

                let previousLocks = Set(previous.scenarioContinuityLockIds)
                let currentLocks = Set(frame.scenarioContinuityLockIds)
                if !previousLocks.isEmpty, previousLocks != currentLocks {
                    issues.append(.init(
                        id: "\(scene.id)-\(frame.id)-locks", severity: .warning,
                        sceneIndex: sceneIndex, frameIndex: frameIndex,
                        title: "Continuity-locks er endret",
                        detail: "Shot \(frame.shotNumber) arver ikke samme låste karakter-, kostyme- eller prop-egenskaper."))
                }
                if StoryboardReadiness.hasVisual(previous), !StoryboardReadiness.hasVisual(frame) {
                    issues.append(.init(
                        id: "\(scene.id)-\(frame.id)-visual", severity: .warning,
                        sceneIndex: sceneIndex, frameIndex: frameIndex,
                        title: "Manglende panel",
                        detail: "Shot \(frame.shotNumber) bryter en ellers visualisert sekvens."))
                }
            }
        }
        return issues
    }

    static func visualIntensity(_ frame: FrameSummary) -> Double {
        let shot: [String: Double] = [
            "EWS": 0.12, "WS": 0.24, "MS": 0.42, "MCU": 0.58,
            "CU": 0.76, "ECU": 0.92, "OTS": 0.6, "POV": 0.72,
        ]
        var score = shot[frame.shotType ?? ""] ?? 0.35
        let movement = (frame.movement ?? "").lowercased()
        if movement.contains("handheld") { score += 0.16 }
        else if !movement.isEmpty && movement != "static" { score += 0.08 }
        let beat = (frame.beatTag ?? "").lowercased()
        if beat.contains("action") || beat.contains("tension") { score += 0.12 }
        if frame.focusDepth?.lowercased() == "shallow" { score += 0.05 }
        return min(1, max(0.05, score))
    }
}

private extension String {
    var trimmed: String { trimmingCharacters(in: .whitespacesAndNewlines) }
}

struct BoardProductionDashboard: View {
    let projectTitle: String
    let scenes: [SceneSummary]
    let onSelectFrame: (Int, Int) -> Void
    @Environment(\.dismiss) private var dismiss
    @State private var tab = Tab.coverage

    enum Tab: String, CaseIterable, Identifiable {
        case coverage = "Coverage"
        case continuity = "Continuity"
        case visualArc = "Visual Arc"
        var id: String { rawValue }
    }

    private var allFrames: [(Int, Int, SceneSummary, FrameSummary)] {
        scenes.enumerated().flatMap { sceneIndex, scene in
            scene.frames.enumerated().map { (sceneIndex, $0.offset, scene, $0.element) }
        }
    }

    private var readiness: Double {
        let values = allFrames.map { StoryboardReadiness.frame($0.3).progress }
        return values.isEmpty ? 0 : values.reduce(0, +) / Double(values.count)
    }

    var body: some View {
        NavigationStack {
            VStack(spacing: 0) {
                summaryHeader
                Picker("Produksjonsanalyse", selection: $tab) {
                    ForEach(Tab.allCases) { Text($0.rawValue).tag($0) }
                }
                .pickerStyle(.segmented)
                .padding(.horizontal, 20).padding(.bottom, 14)

                Group {
                    switch tab {
                    case .coverage: coverage
                    case .continuity: continuity
                    case .visualArc: visualArc
                    }
                }
            }
            .background(Color(uiColor: .systemGroupedBackground))
            .navigationTitle("Production Health")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) { Button("Ferdig") { dismiss() } }
            }
        }
    }

    private var summaryHeader: some View {
        HStack(spacing: 18) {
            ZStack {
                Circle().stroke(Color.secondary.opacity(0.18), lineWidth: 8)
                Circle().trim(from: 0, to: readiness)
                    .stroke(BoardBrand.accent, style: StrokeStyle(lineWidth: 8, lineCap: .round))
                    .rotationEffect(.degrees(-90))
                Text("\(Int(readiness * 100))%")
                    .font(.system(size: 18, weight: .bold, design: .rounded))
            }
            .frame(width: 76, height: 76)
            VStack(alignment: .leading, spacing: 4) {
                Text(projectTitle).font(.headline)
                Text("\(scenes.count) scener · \(allFrames.count) shots")
                    .font(.subheadline).foregroundStyle(.secondary)
                Text("Viser manglende dekning og mulige avvik – kreative valg blokkeres aldri.")
                    .font(.caption).foregroundStyle(.secondary)
            }
            Spacer()
        }
        .padding(20)
    }

    private var coverage: some View {
        List {
            ForEach(Array(scenes.enumerated()), id: \.element.id) { sceneIndex, scene in
                Section(scene.heading) {
                    ForEach(Array(scene.frames.enumerated()), id: \.element.id) { frameIndex, frame in
                        let status = StoryboardReadiness.frame(frame)
                        Button {
                            onSelectFrame(sceneIndex, frameIndex)
                            dismiss()
                        } label: {
                            HStack(spacing: 12) {
                                Text(frame.shotNumber).font(.headline.monospacedDigit()).frame(width: 42)
                                VStack(alignment: .leading, spacing: 5) {
                                    Text(frame.description.isEmpty ? "Uten handling/dialog" : frame.description)
                                        .lineLimit(1).foregroundStyle(.primary)
                                    ProgressView(value: status.progress).tint(status.progress == 1 ? .green : BoardBrand.accent)
                                    if !status.missing.isEmpty {
                                        Text("Mangler: " + status.missing.joined(separator: " · "))
                                            .font(.caption2).foregroundStyle(.secondary).lineLimit(2)
                                    }
                                }
                                Text("\(status.completed)/\(status.total)")
                                    .font(.caption.monospacedDigit()).foregroundStyle(.secondary)
                            }
                            .frame(minHeight: 52)
                        }
                    }
                }
            }
        }
        .listStyle(.insetGrouped)
    }

    private var continuity: some View {
        let issues = StoryboardProductionAnalysis.continuityIssues(scenes: scenes)
        return Group {
            if issues.isEmpty {
                ContentUnavailableView("Ingen åpenbare avvik", systemImage: "checkmark.shield.fill",
                                       description: Text("Kontroller alltid bevisste continuity-brudd i review."))
            } else {
                List(issues) { issue in
                    Button {
                        onSelectFrame(issue.sceneIndex, issue.frameIndex)
                        dismiss()
                    } label: {
                        Label {
                            VStack(alignment: .leading, spacing: 4) {
                                Text(issue.title).foregroundStyle(.primary)
                                Text(issue.detail).font(.caption).foregroundStyle(.secondary)
                            }
                        } icon: {
                            Image(systemName: issue.severity.symbol).foregroundStyle(issue.severity.color)
                        }
                        .frame(minHeight: 52)
                    }
                }
            }
        }
    }

    private var visualArc: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 20) {
                ForEach(Array(scenes.enumerated()), id: \.element.id) { sceneIndex, scene in
                    VStack(alignment: .leading, spacing: 10) {
                        Text(scene.heading).font(.headline)
                        HStack(alignment: .bottom, spacing: 6) {
                            ForEach(Array(scene.frames.enumerated()), id: \.element.id) { frameIndex, frame in
                                Button {
                                    onSelectFrame(sceneIndex, frameIndex)
                                    dismiss()
                                } label: {
                                    VStack(spacing: 5) {
                                        RoundedRectangle(cornerRadius: 5)
                                            .fill(LinearGradient(colors: [BoardBrand.accent.opacity(0.55), BoardBrand.accent],
                                                                 startPoint: .bottom, endPoint: .top))
                                            .frame(height: 24 + 112 * StoryboardProductionAnalysis.visualIntensity(frame))
                                        Text(frame.shotNumber).font(.caption2.monospacedDigit())
                                    }
                                    .frame(minWidth: 44)
                                }
                                .buttonStyle(.plain)
                                .accessibilityLabel("Shot \(frame.shotNumber), intensitet \(Int(StoryboardProductionAnalysis.visualIntensity(frame) * 100)) prosent")
                            }
                        }
                        .frame(maxWidth: .infinity, alignment: .leading)
                    }
                    .padding(16)
                    .background(.background, in: RoundedRectangle(cornerRadius: 14))
                }
            }
            .padding(20)
        }
    }
}
