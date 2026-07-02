// PondusLynkortView.swift
//
// 3-tab lynkort-visning for Pondus på Apple Watch. TabView med `.page`-stil
// (vertical page på watchOS 10+) — brukeren swiper mellom:
//   1) Mal-liste (velg aktiv mal)
//   2) Aktive steg (tap steg → utvid prompt)
//   3) Anbefalt komm-tone (score-ring + 5 mini-barer)
//
// Design: Mørk bakgrunn + lilla aksent (matcher iPad Leadbook LBrand.purple).
// Watch skjermen er liten så vi holder oss til .system-fonts og tydelig kontrast.

import SwiftUI

struct PondusLynkortView: View {
    @Environment(WatchPondusStore.self) private var store

    var body: some View {
        TabView {
            PondusTemplateListTab()
                .tag(0)
            PondusStepsTab()
                .tag(1)
            PondusToneTab()
                .tag(2)
        }
        .tabViewStyle(.page)
    }
}

// MARK: - Tab 1: Mal-liste

private struct PondusTemplateListTab: View {
    @Environment(WatchPondusStore.self) private var store

    var body: some View {
        NavigationStack {
            List {
                if store.templates.isEmpty {
                    ContentUnavailableView(
                        "Ingen maler",
                        systemImage: "book.pages",
                        description: Text("Åpne Leadgrid på iPhone for å synke pondus-maler.")
                    )
                } else {
                    ForEach(store.templates) { template in
                        Button {
                            store.setActive(template)
                        } label: {
                            row(for: template)
                        }
                        .buttonStyle(.plain)
                    }
                }
            }
            .navigationTitle("Pondus")
        }
    }

    @ViewBuilder
    private func row(for template: WatchPondusTemplate) -> some View {
        HStack(spacing: 8) {
            Text(template.kindEmoji)
                .font(.title3)
            VStack(alignment: .leading, spacing: 2) {
                Text(template.name)
                    .font(.system(size: 13, weight: .semibold))
                    .foregroundStyle(.white)
                    .lineLimit(2)
                HStack(spacing: 4) {
                    Text(template.kindLabel)
                        .font(.system(size: 10))
                        .foregroundStyle(.secondary)
                    Text("•")
                        .font(.system(size: 10))
                        .foregroundStyle(.secondary)
                    Text("Score \(template.score)")
                        .font(.system(size: 10, weight: .semibold))
                        .foregroundStyle(scoreColor(template.score))
                        .monospacedDigit()
                }
            }
            Spacer(minLength: 0)
            if store.activeTemplate?.id == template.id {
                Image(systemName: "checkmark.circle.fill")
                    .foregroundStyle(Color(red: 0.75, green: 0.45, blue: 1.0))
                    .font(.system(size: 14))
            }
        }
        .padding(.vertical, 2)
    }

    private func scoreColor(_ score: Int) -> Color {
        if score >= 85 { return .green }
        if score >= 70 { return .orange }
        return .yellow
    }
}

// MARK: - Tab 2: Aktive steg

private struct PondusStepsTab: View {
    @Environment(WatchPondusStore.self) private var store

    var body: some View {
        NavigationStack {
            if let template = store.activeTemplate {
                List {
                    Section {
                        HStack {
                            Text(template.kindEmoji)
                            Text(template.name)
                                .font(.system(size: 13, weight: .bold))
                                .lineLimit(2)
                        }
                    }
                    ForEach(template.orderedSteps) { step in
                        NavigationLink(destination: PondusStepDetail(step: step)) {
                            HStack(spacing: 8) {
                                Text("\(step.order + 1)")
                                    .font(.system(size: 11, weight: .bold))
                                    .foregroundStyle(.white)
                                    .frame(width: 20, height: 20)
                                    .background(Color(red: 0.66, green: 0.32, blue: 0.99), in: Circle())
                                VStack(alignment: .leading, spacing: 2) {
                                    Text(step.title)
                                        .font(.system(size: 12, weight: .semibold))
                                        .foregroundStyle(.white)
                                        .lineLimit(1)
                                    if let prompt = step.prompt, !prompt.isEmpty {
                                        Text(prompt)
                                            .font(.system(size: 10))
                                            .foregroundStyle(.secondary)
                                            .lineLimit(2)
                                    }
                                }
                            }
                            .padding(.vertical, 2)
                        }
                    }
                }
                .navigationTitle("Steg")
            } else {
                ContentUnavailableView(
                    "Ingen aktiv mal",
                    systemImage: "arrow.left",
                    description: Text("Velg en pondus-mal fra listen først.")
                )
            }
        }
    }
}

private struct PondusStepDetail: View {
    let step: WatchPondusStep

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 10) {
                Text(step.title)
                    .font(.system(size: 15, weight: .bold))
                    .foregroundStyle(.white)
                if let prompt = step.prompt, !prompt.isEmpty {
                    Text(prompt)
                        .font(.system(size: 12))
                        .foregroundStyle(.white.opacity(0.85))
                }
            }
            .padding(.horizontal, 4)
        }
        .navigationTitle("Steg \(step.order + 1)")
    }
}

// MARK: - Tab 3: Anbefalt komm-tone

private struct PondusToneTab: View {
    @Environment(WatchPondusStore.self) private var store

    var body: some View {
        NavigationStack {
            ScrollView {
                if let template = store.activeTemplate {
                    VStack(spacing: 12) {
                        Text(template.name)
                            .font(.system(size: 12, weight: .semibold))
                            .foregroundStyle(.secondary)
                            .lineLimit(1)
                        ScoreRing(score: template.analysis.score)
                            .frame(width: 90, height: 90)
                        VStack(alignment: .leading, spacing: 6) {
                            ToneBar(label: "Autoritet", value: template.analysis.autoritet)
                            ToneBar(label: "Klarhet", value: template.analysis.klarhet)
                            ToneBar(label: "Troverdighet", value: template.analysis.troverdighet)
                            ToneBar(label: "Trygghet", value: template.analysis.trygghet)
                            ToneBar(label: "Fremdrift", value: template.analysis.fremdrift)
                        }
                        .padding(.horizontal, 4)
                    }
                    .padding(.top, 6)
                } else {
                    ContentUnavailableView(
                        "Ingen aktiv mal",
                        systemImage: "chart.bar.fill",
                        description: Text("Velg en pondus-mal for å se anbefalt tone.")
                    )
                }
            }
            .navigationTitle("Tone")
        }
    }
}

private struct ScoreRing: View {
    let score: Int

    private var progress: Double { min(1.0, Double(score) / 100.0) }
    private var color: Color {
        if score >= 85 { return .green }
        if score >= 70 { return .orange }
        return .yellow
    }

    var body: some View {
        ZStack {
            Circle()
                .stroke(Color.white.opacity(0.15), lineWidth: 6)
            Circle()
                .trim(from: 0, to: progress)
                .stroke(color, style: StrokeStyle(lineWidth: 6, lineCap: .round))
                .rotationEffect(.degrees(-90))
            VStack(spacing: 0) {
                Text("\(score)")
                    .font(.system(size: 22, weight: .heavy))
                    .foregroundStyle(.white)
                    .monospacedDigit()
                Text("PONDUS")
                    .font(.system(size: 8, weight: .semibold))
                    .foregroundStyle(.secondary)
            }
        }
    }
}

private struct ToneBar: View {
    let label: String
    let value: Int

    private var color: Color {
        if value >= 85 { return .green }
        if value >= 70 { return .orange }
        return .yellow
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 2) {
            HStack {
                Text(label)
                    .font(.system(size: 10, weight: .medium))
                    .foregroundStyle(.white.opacity(0.85))
                Spacer()
                Text("\(value)")
                    .font(.system(size: 10, weight: .bold))
                    .foregroundStyle(color)
                    .monospacedDigit()
            }
            GeometryReader { geo in
                ZStack(alignment: .leading) {
                    Capsule().fill(Color.white.opacity(0.15))
                    Capsule().fill(color)
                        .frame(width: geo.size.width * min(1.0, Double(value) / 100.0))
                }
            }
            .frame(height: 4)
        }
    }
}
