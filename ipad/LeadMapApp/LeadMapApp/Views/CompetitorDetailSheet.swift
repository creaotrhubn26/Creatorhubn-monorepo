// CompetitorDetailSheet.swift
//
// Lese-only detail for konkurrenter på kartet. iPad-appen er for
// feltsalg — manuell add og Claude-assess (PATCH/POST) skjer i web.

import SwiftUI

struct CompetitorDetailSheet: View {
    let competitor: CompetitorModel
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 18) {
                    header
                    if let positioning = competitor.positioning {
                        infoBlock(label: "Posisjonering", text: positioning, color: .purple)
                    }
                    if let offer = competitor.primaryOffer {
                        infoBlock(label: "Tilbud", text: offer, color: .red)
                    }
                    if competitor.claudeThreatSummary != nil
                        || competitor.claudeWhatToWorryAbout != nil
                        || competitor.claudeWhatToIgnore != nil {
                        claudeSection
                    }
                    contactRows
                    if competitor.claudeAssessedAt == nil {
                        ContentUnavailableView(
                            "Ikke vurdert ennå",
                            systemImage: "sparkles",
                            description: Text("Åpne web-versjonen for å få Role Room Agent til å vurdere denne konkurrenten.")
                        )
                        .padding(.top, 8)
                    }
                }
                .padding(16)
            }
            .navigationTitle("Konkurrent")
        .salesHierarchyBackdrop(.research)
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button("Lukk") { dismiss() }
                }
            }
        }
        .presentationDetents([.medium, .large])
    }

    // MARK: - Sections

    private var header: some View {
        HStack(alignment: .top, spacing: 14) {
            ZStack {
                Diamond()
                    .fill(threatColor)
                    .frame(width: 56, height: 56)
                Image(systemName: "star.fill")
                    .font(.title3)
                    .foregroundStyle(.white)
            }
            VStack(alignment: .leading, spacing: 4) {
                HStack(spacing: 6) {
                    Text("KONKURRENT")
                        .font(.caption2.bold())
                        .padding(.horizontal, 6)
                        .padding(.vertical, 2)
                        .background(Color.red.opacity(0.18))
                        .foregroundStyle(.red)
                        .clipShape(Capsule())
                    if competitor.isManualAddition {
                        Text("MANUELL")
                            .font(.caption2.bold())
                            .padding(.horizontal, 6)
                            .padding(.vertical, 2)
                            .background(Color.purple.opacity(0.18))
                            .foregroundStyle(.purple)
                            .clipShape(Capsule())
                    }
                }
                Text(competitor.name).font(.title3.bold())
                if !competitor.domain.isEmpty {
                    if let url = URL(string: competitor.domain.hasPrefix("http") ? competitor.domain : "https://\(competitor.domain)") {
                        Link(competitor.domain, destination: url)
                            .font(.caption)
                            .lineLimit(1)
                    }
                }
                if let level = competitor.threatLevel {
                    HStack(spacing: 6) {
                        Circle().fill(threatColor).frame(width: 8, height: 8)
                        Text(threatLabel(level)).font(.caption.bold()).foregroundStyle(threatColor)
                        if let score = competitor.threatScore {
                            Text("(\(score)/100)").font(.caption2).foregroundStyle(.secondary)
                        }
                    }
                }
            }
            Spacer()
        }
    }

    private var claudeSection: some View {
        VStack(alignment: .leading, spacing: 10) {
            Label("Claude vurdering", systemImage: "sparkles")
                .font(.caption.bold())
                .foregroundStyle(.purple)
                .textCase(.uppercase)
            if let summary = competitor.claudeThreatSummary {
                Text(summary).font(.subheadline)
            }
            if let worry = competitor.claudeWhatToWorryAbout {
                VStack(alignment: .leading, spacing: 2) {
                    Text("BEKYMRE SEG FOR").font(.caption2.bold()).foregroundStyle(.red)
                    Text(worry).font(.caption).foregroundStyle(.secondary)
                }
            }
            if let ignore = competitor.claudeWhatToIgnore {
                VStack(alignment: .leading, spacing: 2) {
                    Text("IGNORER").font(.caption2.bold()).foregroundStyle(.green)
                    Text(ignore).font(.caption).foregroundStyle(.secondary)
                }
            }
        }
        .padding(14)
        .background(Color.purple.opacity(0.06), in: RoundedRectangle(cornerRadius: 12))
        .overlay(
            RoundedRectangle(cornerRadius: 12)
                .stroke(Color.purple.opacity(0.32), lineWidth: 1)
        )
    }

    private var contactRows: some View {
        VStack(alignment: .leading, spacing: 8) {
            if let addr = competitor.address {
                Label(addr, systemImage: "mappin")
                    .font(.subheadline)
            }
            if let phone = competitor.phone {
                Link(destination: URL(string: "tel:\(phone)")!) {
                    Label(phone, systemImage: "phone")
                }
            }
            if let rating = competitor.rating {
                Label("\(rating, format: .number.precision(.fractionLength(1))) ⭐", systemImage: "star")
                    .font(.subheadline)
                    .foregroundStyle(.yellow)
            }
            if let cat = competitor.category {
                Label(cat, systemImage: "tag")
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
            }
        }
    }

    // MARK: - Helpers

    private func infoBlock(label: String, text: String, color: Color) -> some View {
        VStack(alignment: .leading, spacing: 4) {
            Text(label.uppercased()).font(.caption2.bold()).foregroundStyle(color)
            Text(text).font(.subheadline)
        }
        .padding(12)
        .background(color.opacity(0.06), in: RoundedRectangle(cornerRadius: 10))
        .overlay(
            RoundedRectangle(cornerRadius: 10)
                .stroke(color.opacity(0.28), lineWidth: 1)
        )
    }

    private var threatColor: Color {
        switch competitor.threatLevel {
        case .near: return .red
        case .medium: return .orange
        case .far: return .gray
        case .none: return Color(.systemGray)
        }
    }

    private func threatLabel(_ level: ThreatLevel) -> String {
        switch level {
        case .near: return "NÆR TRUSSEL"
        case .medium: return "MEDIUM"
        case .far: return "FJERN"
        }
    }
}

private struct Diamond: Shape {
    func path(in rect: CGRect) -> Path {
        var p = Path()
        p.move(to: CGPoint(x: rect.midX, y: rect.minY))
        p.addLine(to: CGPoint(x: rect.maxX, y: rect.midY))
        p.addLine(to: CGPoint(x: rect.midX, y: rect.maxY))
        p.addLine(to: CGPoint(x: rect.minX, y: rect.midY))
        p.closeSubpath()
        return p
    }
}
