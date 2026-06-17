// MeetingBriefSheet.swift
//
// 30-sekunders forberedelse-readout for selger før møte. Claude
// genererer fra lead-status + siste 5 besøk + notater.

import SwiftUI

struct MeetingBriefSheet: View {
    @Environment(AppState.self) private var state
    @Environment(\.dismiss) private var dismiss
    let lead: LeadModel
    @State private var brief: MeetingBrief?
    @State private var loading = false
    @State private var error: String?

    var body: some View {
        NavigationStack {
            Group {
                if loading {
                    ProgressView("Claude leser opp leadet…")
                        .frame(maxWidth: .infinity, maxHeight: .infinity)
                } else if let brief = brief {
                    briefContent(brief)
                } else if let err = error {
                    errorView(err)
                } else {
                    EmptyView()
                }
            }
            .navigationTitle("Forbered til møte")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button("Ferdig") { dismiss() }
                }
                ToolbarItem(placement: .topBarLeading) {
                    Button {
                        Task { await load(forceRefresh: true) }
                    } label: {
                        Image(systemName: "arrow.clockwise")
                    }
                    .disabled(loading)
                }
            }
            .task { await load() }
        }
    }

    @ViewBuilder
    private func briefContent(_ brief: MeetingBrief) -> some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 16) {
                headerCard(brief)
                if let profile = brief.company_profile {
                    companyProfileCard(profile)
                }
                if let strategic = brief.strategic_value, !strategic.isEmpty {
                    strategicValueCard(strategic)
                }
                if let approach = brief.personal_approach, !approach.isEmpty {
                    personalApproachCard(approach)
                }
                if let contracts = brief.contract_recommendations, !contracts.isEmpty {
                    contractsCard(contracts)
                }
                if let pitch = brief.pitch_deck_suggestion {
                    pitchDeckCard(pitch)
                }
                if !brief.warnings.isEmpty {
                    sectionCard(
                        title: "Vær obs på",
                        icon: "exclamationmark.triangle.fill",
                        color: Color(red: 0.97, green: 0.45, blue: 0.45),
                        items: brief.warnings,
                    )
                }
                if !brief.talking_points.isEmpty {
                    sectionCard(
                        title: "Snakk om",
                        icon: "bubble.left.and.bubble.right.fill",
                        color: Color(red: 0.75, green: 0.52, blue: 0.99),
                        items: brief.talking_points,
                    )
                }
                if !brief.questions_to_ask.isEmpty {
                    sectionCard(
                        title: "Spør om",
                        icon: "questionmark.bubble.fill",
                        color: Color(red: 0.37, green: 0.65, blue: 0.98),
                        items: brief.questions_to_ask,
                    )
                }
                if !brief.progress_tips.isEmpty {
                    sectionCard(
                        title: "For å drive framover",
                        icon: "arrow.up.right.circle.fill",
                        color: Color(red: 0.20, green: 0.85, blue: 0.60),
                        items: brief.progress_tips,
                    )
                }
            }
            .padding()
        }
    }

    private func headerCard(_ brief: MeetingBrief) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            Stack(direction: .horizontal, spacing: 8) {
                Image(systemName: "sparkles")
                    .foregroundStyle(Color(red: 0.98, green: 0.75, blue: 0.14))
                Text(lead.name).font(.title3.bold())
            }
            Text(brief.headline)
                .font(.headline)
                .foregroundStyle(.primary)
            Divider().padding(.vertical, 2)
            Text(brief.key_status)
                .font(.callout)
                .foregroundStyle(.secondary)
        }
        .padding()
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Color(.secondarySystemBackground), in: RoundedRectangle(cornerRadius: 12))
    }

    private func sectionCard(title: String, icon: String, color: Color, items: [String]) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            Label(title, systemImage: icon)
                .font(.headline)
                .foregroundStyle(color)
            ForEach(items, id: \.self) { item in
                HStack(alignment: .top, spacing: 8) {
                    Circle().fill(color.opacity(0.5)).frame(width: 5, height: 5)
                        .padding(.top, 6)
                    Text(item).font(.callout)
                }
            }
        }
        .padding()
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(color.opacity(0.08), in: RoundedRectangle(cornerRadius: 12))
        .overlay(
            RoundedRectangle(cornerRadius: 12)
                .stroke(color.opacity(0.3), lineWidth: 1),
        )
    }

    // MARK: - Nye kort (PR #642)

    private func companyProfileCard(_ profile: MeetingBrief.CompanyProfile) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            Label("Bedrifts-profil", systemImage: "building.2.fill")
                .font(.headline)
            HStack(spacing: 12) {
                if let year = profile.founded_year {
                    chip("Stiftet \(year)", color: profile.ageColor)
                }
                if let label = profile.age_label {
                    chip(label.capitalized, color: profile.ageColor)
                }
                if let health = profile.financial_health, health != "ukjent" {
                    chip("Økonomi: \(health)", color: profile.financialColor)
                }
            }
            if let facts = profile.key_facts, !facts.isEmpty {
                Divider().padding(.vertical, 4)
                ForEach(facts, id: \.self) { fact in
                    HStack(alignment: .top, spacing: 6) {
                        Image(systemName: "info.circle")
                            .font(.caption)
                            .foregroundStyle(.secondary)
                        Text(fact).font(.caption)
                    }
                }
            }
        }
        .padding()
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Color(.secondarySystemBackground), in: RoundedRectangle(cornerRadius: 12))
    }

    private func strategicValueCard(_ value: String) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            Label("Strategisk verdi", systemImage: "target")
                .font(.headline)
                .foregroundStyle(Color(red: 0.98, green: 0.75, blue: 0.14))
            Text(value).font(.callout)
        }
        .padding()
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Color(red: 0.98, green: 0.75, blue: 0.14).opacity(0.08),
                    in: RoundedRectangle(cornerRadius: 12))
        .overlay(
            RoundedRectangle(cornerRadius: 12)
                .stroke(Color(red: 0.98, green: 0.75, blue: 0.14).opacity(0.3), lineWidth: 1),
        )
    }

    private func personalApproachCard(_ approach: String) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            Label("Slik bør du fremtre", systemImage: "person.crop.circle.badge.checkmark")
                .font(.headline)
                .foregroundStyle(Color(red: 0.37, green: 0.65, blue: 0.98))
            Text(approach).font(.callout)
        }
        .padding()
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Color(red: 0.37, green: 0.65, blue: 0.98).opacity(0.08),
                    in: RoundedRectangle(cornerRadius: 12))
    }

    private func contractsCard(_ contracts: [MeetingBrief.ContractRecommendation]) -> some View {
        VStack(alignment: .leading, spacing: 12) {
            Label("Anbefalt kontrakt-type", systemImage: "doc.text.fill")
                .font(.headline)
                .foregroundStyle(Color(red: 0.20, green: 0.85, blue: 0.60))
            ForEach(contracts) { rec in
                VStack(alignment: .leading, spacing: 4) {
                    HStack {
                        Text(rec.type.capitalized).font(.subheadline.bold())
                        Spacer()
                        chip("\(rec.fit_score)% match", color: rec.fitColor)
                    }
                    Text(rec.reason)
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }
                .padding(10)
                .frame(maxWidth: .infinity, alignment: .leading)
                .background(Color(hex: rec.fitColor).opacity(0.08),
                            in: RoundedRectangle(cornerRadius: 8))
            }
        }
        .padding()
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Color(red: 0.20, green: 0.85, blue: 0.60).opacity(0.05),
                    in: RoundedRectangle(cornerRadius: 12))
    }

    private func pitchDeckCard(_ pitch: MeetingBrief.PitchDeckSuggestion) -> some View {
        VStack(alignment: .leading, spacing: 10) {
            Label("Pitch-deck for dette møtet", systemImage: "rectangle.stack.fill")
                .font(.headline)
                .foregroundStyle(Color(red: 0.75, green: 0.52, blue: 0.99))
            if let slides = pitch.recommended_slides, !slides.isEmpty {
                Text("Vis disse slidene")
                    .font(.caption.bold())
                    .foregroundStyle(.secondary)
                ForEach(slides) { slide in
                    VStack(alignment: .leading, spacing: 4) {
                        HStack(spacing: 6) {
                            Image(systemName: "checkmark.circle.fill")
                                .foregroundStyle(Color(red: 0.20, green: 0.85, blue: 0.60))
                                .font(.caption)
                            Text(slide.title).font(.callout.bold())
                        }
                        Text(slide.rationale)
                            .font(.caption)
                            .foregroundStyle(.secondary)
                            .padding(.leading, 22)
                    }
                }
            }
            if let skipped = pitch.skip_slides, !skipped.isEmpty {
                Divider().padding(.vertical, 4)
                Text("Hopp over")
                    .font(.caption.bold())
                    .foregroundStyle(.secondary)
                ForEach(skipped, id: \.self) { slide in
                    HStack(spacing: 6) {
                        Image(systemName: "xmark.circle")
                            .foregroundStyle(.secondary)
                            .font(.caption)
                        Text(slide).font(.caption).foregroundStyle(.secondary)
                    }
                }
            }
            if let proofs = pitch.key_proof_points, !proofs.isEmpty {
                Divider().padding(.vertical, 4)
                Text("Sterkeste bevis-punkter")
                    .font(.caption.bold())
                    .foregroundStyle(.secondary)
                ForEach(proofs, id: \.self) { proof in
                    HStack(alignment: .top, spacing: 6) {
                        Image(systemName: "sparkles")
                            .foregroundStyle(Color(red: 0.98, green: 0.75, blue: 0.14))
                            .font(.caption)
                        Text(proof).font(.caption)
                    }
                }
            }
        }
        .padding()
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Color(red: 0.75, green: 0.52, blue: 0.99).opacity(0.08),
                    in: RoundedRectangle(cornerRadius: 12))
    }

    private func chip(_ text: String, color: String) -> some View {
        Text(text)
            .font(.caption2.bold())
            .padding(.horizontal, 6).padding(.vertical, 2)
            .background(Color(hex: color).opacity(0.2), in: Capsule())
            .foregroundStyle(Color(hex: color))
    }

    private func errorView(_ msg: String) -> some View {
        VStack(spacing: 12) {
            Image(systemName: "exclamationmark.triangle")
                .font(.largeTitle).foregroundStyle(.secondary)
            Text("Klarte ikke hente brief")
                .font(.headline)
            Text(msg).font(.caption).multilineTextAlignment(.center)
                .foregroundStyle(.secondary)
                .padding(.horizontal)
            Button("Prøv igjen") {
                Task { await load(forceRefresh: true) }
            }
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    }

    @MainActor
    private func load(forceRefresh: Bool = false) async {
        guard let api = state.api else { return }
        loading = true; error = nil
        defer { loading = false }
        do {
            brief = try await api.fetchMeetingBrief(leadId: lead.id)
        } catch {
            self.error = error.localizedDescription
        }
    }
}

// Stand-in for HStack m/ Stack-stil (kompabilitet)
private struct Stack<Content: View>: View {
    enum Direction { case horizontal, vertical }
    let direction: Direction
    let spacing: CGFloat
    @ViewBuilder let content: () -> Content

    init(direction: Direction, spacing: CGFloat = 0, @ViewBuilder content: @escaping () -> Content) {
        self.direction = direction
        self.spacing = spacing
        self.content = content
    }

    var body: some View {
        if direction == .horizontal {
            HStack(spacing: spacing) { content() }
        } else {
            VStack(spacing: spacing) { content() }
        }
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
