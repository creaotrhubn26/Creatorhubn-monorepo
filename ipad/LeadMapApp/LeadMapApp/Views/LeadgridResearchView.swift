// LeadgridResearchView.swift
//
// Native AI-research-rapport per kunde. Eierens kontekst:
//   - Markedssjef trykker "Research med AI" på en lead → view popper opp
//   - Backend kjører BRREG + website-skraping + Claude Opus 4.7
//   - Vi viser SWOT, beslutningstakere, foreslått første-touch
//
// Cache: GET først for å vise eksisterende research instantly, mens
// "Kjør på nytt"-knappen alltid trigger POST som regenererer.
//
// Mountes fra:
//   - LeadgridCustomerDetailView (som ny seksjon/sheet)
//   - MapScreen LeadDetailSheet (som CTA-knapp)
//   - LeadgridHubView Research-seksjonen (som listet item)

import SwiftUI
import UIKit

struct LeadgridResearchView: View {
    let leadId: String
    let leadName: String
    let api: APIClient

    @Environment(\.dismiss) private var dismiss
    @Environment(\.openURL) private var openURL

    @State private var research: LeadgridResearch?
    @State private var loading = true
    @State private var running = false
    @State private var errorText: String?
    @State private var copiedConfirmation = false

    var body: some View {
        NavigationStack {
            content
                .navigationTitle("Research")
                .navigationBarTitleDisplayMode(.inline)
                .toolbar {
                    ToolbarItem(placement: .cancellationAction) {
                        Button("Lukk") { dismiss() }
                    }
                    if research != nil {
                        ToolbarItem(placement: .primaryAction) {
                            Button {
                                Task { await rerun() }
                            } label: {
                                if running {
                                    ProgressView()
                                } else {
                                    Label("Kjør på nytt", systemImage: "arrow.clockwise")
                                }
                            }
                            .disabled(running)
                        }
                    }
                }
                .task { await loadCached() }
        }
    }

    // MARK: - Top-level layout

    @ViewBuilder
    private var content: some View {
        if loading {
            VStack(spacing: 12) {
                ProgressView()
                Text("Henter research …")
                    .font(.callout)
                    .foregroundStyle(.secondary)
            }
            .frame(maxWidth: .infinity, maxHeight: .infinity)
        } else if running && research == nil {
            runningState
        } else if let r = research {
            ScrollView {
                VStack(alignment: .leading, spacing: 20) {
                    header(r)
                    swotGrid(r.swot)
                    decisionMakersCard(r.decisionMakers)
                    firstTouchCard(r.firstTouch)
                    if let risk = r.risk, !risk.isEmpty {
                        riskCard(risk)
                    }
                    metaCard(r)
                }
                .padding()
            }
        } else {
            emptyState
        }
    }

    private var runningState: some View {
        VStack(spacing: 16) {
            ProgressView().scaleEffect(1.4)
            Text("Claude analyserer …")
                .font(.headline)
            Text("Henter BRREG-data, skraper nettside og lager SWOT + outreach-plan. Tar typisk 15-30 sek.")
                .font(.callout)
                .foregroundStyle(.secondary)
                .multilineTextAlignment(.center)
                .padding(.horizontal, 24)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    }

    private var emptyState: some View {
        VStack(spacing: 16) {
            Image(systemName: "sparkles.rectangle.stack.fill")
                .font(.system(size: 56))
                .foregroundStyle(.purple)
            Text("Ingen research enda")
                .font(.title3.bold())
            Text("Kjør AI-research på \(leadName) for å få SWOT, beslutningstakere og en ferdig første-touch.")
                .font(.callout)
                .foregroundStyle(.secondary)
                .multilineTextAlignment(.center)
                .padding(.horizontal, 24)
            Button {
                Task { await rerun() }
            } label: {
                Label("Kjør research nå", systemImage: "sparkles")
                    .font(.headline)
                    .padding(.horizontal, 18)
                    .padding(.vertical, 10)
            }
            .buttonStyle(.borderedProminent)
            .tint(.purple)
            if let errorText {
                Text(errorText)
                    .font(.caption)
                    .foregroundStyle(.red)
                    .padding(.horizontal, 24)
                    .multilineTextAlignment(.center)
            }
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    }

    // MARK: - Sections

    @ViewBuilder
    private func header(_ r: LeadgridResearch) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack(alignment: .top) {
                VStack(alignment: .leading, spacing: 4) {
                    Text(leadName)
                        .font(.title2.bold())
                    if let cat = r.category, !cat.isEmpty {
                        Text(cat)
                            .font(.callout)
                            .foregroundStyle(.secondary)
                    }
                }
                Spacer()
                opportunityBadge(r)
            }
            if let errorText {
                Label(errorText, systemImage: "exclamationmark.triangle.fill")
                    .font(.caption)
                    .foregroundStyle(.red)
            }
        }
        .padding()
        .background(Color.purple.opacity(0.08),
                     in: RoundedRectangle(cornerRadius: 14))
        .overlay(RoundedRectangle(cornerRadius: 14)
                    .strokeBorder(Color.purple.opacity(0.20)))
    }

    @ViewBuilder
    private func opportunityBadge(_ r: LeadgridResearch) -> some View {
        let tier = r.opportunityColor
        VStack(spacing: 2) {
            if let s = r.opportunityScore {
                Text("\(s)")
                    .font(.title.bold())
                    .foregroundStyle(tierColor(tier))
            } else {
                Text("—").font(.title.bold()).foregroundStyle(.secondary)
            }
            Text(tier.label.uppercased())
                .font(.caption2.bold())
                .foregroundStyle(.secondary)
        }
        .frame(width: 64, height: 56)
        .background(tierColor(tier).opacity(0.15),
                     in: RoundedRectangle(cornerRadius: 10))
    }

    @ViewBuilder
    private func swotGrid(_ swot: LeadgridResearchSWOT) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            sectionHeader("SWOT", icon: "square.grid.2x2.fill")
            LazyVGrid(
                columns: [GridItem(.flexible(), spacing: 10),
                          GridItem(.flexible(), spacing: 10)],
                spacing: 10
            ) {
                swotQuadrant(
                    title: "Styrker",
                    icon: "checkmark.shield.fill",
                    color: .green,
                    items: swot.strengths
                )
                swotQuadrant(
                    title: "Svakheter",
                    icon: "exclamationmark.shield.fill",
                    color: .orange,
                    items: swot.weaknesses
                )
                swotQuadrant(
                    title: "Muligheter",
                    icon: "lightbulb.fill",
                    color: .blue,
                    items: swot.opportunities
                )
                swotQuadrant(
                    title: "Trusler",
                    icon: "flame.fill",
                    color: .red,
                    items: swot.threats
                )
            }
        }
    }

    @ViewBuilder
    private func swotQuadrant(
        title: String,
        icon: String,
        color: Color,
        items: [String]
    ) -> some View {
        VStack(alignment: .leading, spacing: 0) {
            // Farget topp
            HStack(spacing: 6) {
                Image(systemName: icon)
                Text(title).font(.subheadline.bold())
            }
            .foregroundStyle(.white)
            .padding(.horizontal, 10)
            .padding(.vertical, 6)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(color)
            // Bullet-liste
            VStack(alignment: .leading, spacing: 6) {
                if items.isEmpty {
                    Text("(ingen)")
                        .font(.caption)
                        .foregroundStyle(.tertiary)
                        .italic()
                } else {
                    ForEach(Array(items.enumerated()), id: \.offset) { _, item in
                        HStack(alignment: .top, spacing: 6) {
                            Text("•")
                                .foregroundStyle(color)
                                .font(.caption.bold())
                            Text(item)
                                .font(.caption)
                                .foregroundStyle(.primary)
                                .fixedSize(horizontal: false, vertical: true)
                        }
                    }
                }
            }
            .padding(10)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(color.opacity(0.06))
        }
        .clipShape(RoundedRectangle(cornerRadius: 10))
        .overlay(RoundedRectangle(cornerRadius: 10)
                    .strokeBorder(color.opacity(0.30)))
    }

    @ViewBuilder
    private func decisionMakersCard(_ makers: [LeadgridResearchDecisionMaker]) -> some View {
        VStack(alignment: .leading, spacing: 10) {
            sectionHeader("Beslutningstakere", icon: "person.2.fill")
            if makers.isEmpty {
                Text("(ingen identifisert)")
                    .font(.callout)
                    .foregroundStyle(.secondary)
                    .italic()
            } else {
                ForEach(makers) { m in
                    VStack(alignment: .leading, spacing: 4) {
                        HStack(spacing: 8) {
                            Image(systemName: "person.crop.circle.fill")
                                .foregroundStyle(.purple)
                            VStack(alignment: .leading, spacing: 2) {
                                Text(m.role)
                                    .font(.subheadline.bold())
                                if let t = m.title, !t.isEmpty, t != m.role {
                                    Text(t)
                                        .font(.caption)
                                        .foregroundStyle(.secondary)
                                }
                            }
                        }
                        Text(m.why)
                            .font(.caption)
                            .foregroundStyle(.primary)
                            .padding(.leading, 28)
                    }
                    .padding(10)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .background(Color(.secondarySystemBackground),
                                 in: RoundedRectangle(cornerRadius: 8))
                }
            }
        }
        .padding()
        .background(Color(.systemBackground),
                     in: RoundedRectangle(cornerRadius: 12))
        .overlay(RoundedRectangle(cornerRadius: 12)
                    .strokeBorder(Color.purple.opacity(0.20)))
    }

    @ViewBuilder
    private func firstTouchCard(_ touch: LeadgridResearchFirstTouch) -> some View {
        VStack(alignment: .leading, spacing: 10) {
            sectionHeader("Foreslått første-touch", icon: "paperplane.fill")
            HStack(spacing: 8) {
                Label(touch.channel.label, systemImage: touch.channel.systemIcon)
                    .font(.caption.bold())
                    .padding(.horizontal, 10).padding(.vertical, 4)
                    .background(Color.purple.opacity(0.15), in: Capsule())
                    .foregroundStyle(.purple)
                Spacer()
            }
            if let subject = touch.subject, !subject.isEmpty {
                VStack(alignment: .leading, spacing: 2) {
                    Text("Emne")
                        .font(.caption2.bold())
                        .foregroundStyle(.secondary)
                    Text(subject)
                        .font(.subheadline.bold())
                }
            }
            VStack(alignment: .leading, spacing: 2) {
                Text("Melding")
                    .font(.caption2.bold())
                    .foregroundStyle(.secondary)
                Text(touch.body)
                    .font(.callout)
                    .foregroundStyle(.primary)
                    .fixedSize(horizontal: false, vertical: true)
            }
            HStack(spacing: 8) {
                Button {
                    copyFirstTouch(touch)
                } label: {
                    Label(copiedConfirmation ? "Kopiert!" : "Kopier",
                           systemImage: copiedConfirmation ? "checkmark" : "doc.on.doc")
                        .font(.callout.bold())
                }
                .buttonStyle(.bordered)
                .tint(.purple)

                Button {
                    sendFirstTouch(touch)
                } label: {
                    Label(sendActionLabel(touch.channel),
                           systemImage: touch.channel.systemIcon)
                        .font(.callout.bold())
                }
                .buttonStyle(.borderedProminent)
                .tint(.purple)
                .disabled(!canSend(touch))
            }
        }
        .padding()
        .background(Color(.systemBackground),
                     in: RoundedRectangle(cornerRadius: 12))
        .overlay(RoundedRectangle(cornerRadius: 12)
                    .strokeBorder(Color.purple.opacity(0.20)))
    }

    @ViewBuilder
    private func riskCard(_ risk: String) -> some View {
        VStack(alignment: .leading, spacing: 6) {
            sectionHeader("Risiko", icon: "exclamationmark.triangle.fill")
            Text(risk)
                .font(.callout)
                .foregroundStyle(.primary)
        }
        .padding()
        .background(Color.orange.opacity(0.08),
                     in: RoundedRectangle(cornerRadius: 12))
        .overlay(RoundedRectangle(cornerRadius: 12)
                    .strokeBorder(Color.orange.opacity(0.30)))
    }

    @ViewBuilder
    private func metaCard(_ r: LeadgridResearch) -> some View {
        HStack(spacing: 8) {
            Image(systemName: "clock")
                .foregroundStyle(.secondary)
            Text("Generert: \(formattedDate(r.generatedAt))")
                .font(.caption)
                .foregroundStyle(.secondary)
            Spacer()
            Text("Claude Opus 4.7")
                .font(.caption2)
                .foregroundStyle(.tertiary)
        }
        .padding(.horizontal, 4)
    }

    @ViewBuilder
    private func sectionHeader(_ title: String, icon: String) -> some View {
        Label(title, systemImage: icon)
            .font(.headline)
            .foregroundStyle(.purple)
    }

    // MARK: - Helpers

    private func tierColor(_ tier: OpportunityTier) -> Color {
        switch tier {
        case .hot: return .red
        case .warm: return .orange
        case .cool: return .blue
        case .unknown: return .gray
        }
    }

    private func sendActionLabel(_ channel: FirstTouchChannel) -> String {
        switch channel {
        case .email: return "Send e-post"
        case .linkedin: return "Åpne LinkedIn"
        case .phone: return "Ring"
        case .inPerson: return "Naviger"
        }
    }

    private func canSend(_ touch: LeadgridResearchFirstTouch) -> Bool {
        // Vi kan alltid åpne Mail/LinkedIn/Phone — selv om vi ikke har
        // mottaker, kan markedssjef velge i app'en. inPerson har ingen
        // direkte URL-handling.
        touch.channel != .inPerson
    }

    @MainActor
    private func copyFirstTouch(_ touch: LeadgridResearchFirstTouch) {
        let combined: String
        if let subject = touch.subject, !subject.isEmpty {
            combined = "\(subject)\n\n\(touch.body)"
        } else {
            combined = touch.body
        }
        UIPasteboard.general.string = combined
        withAnimation { copiedConfirmation = true }
        Task { @MainActor in
            try? await Task.sleep(nanoseconds: 1_800_000_000)
            copiedConfirmation = false
        }
    }

    @MainActor
    private func sendFirstTouch(_ touch: LeadgridResearchFirstTouch) {
        // Bygg deep-link basert på kanal. Pre-fylling av mottaker krever
        // lead-data — vi støtter pasted-content som backup.
        let subj = touch.subject ?? ""
        let body = touch.body
        switch touch.channel {
        case .email:
            let encodedSubj = subj.addingPercentEncoding(
                withAllowedCharacters: .urlQueryAllowed
            ) ?? subj
            let encodedBody = body.addingPercentEncoding(
                withAllowedCharacters: .urlQueryAllowed
            ) ?? body
            if let url = URL(string: "mailto:?subject=\(encodedSubj)&body=\(encodedBody)") {
                openURL(url)
            }
        case .linkedin:
            if let url = URL(string: "https://www.linkedin.com/search/results/people/") {
                openURL(url)
            }
        case .phone:
            if let url = URL(string: "tel:") {
                openURL(url)
            }
        case .inPerson:
            break
        }
    }

    private func formattedDate(_ iso: String?) -> String {
        guard let iso else { return "ukjent" }
        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        if let date = formatter.date(from: iso) {
            return shortDate(date)
        }
        formatter.formatOptions = [.withInternetDateTime]
        if let date = formatter.date(from: iso) {
            return shortDate(date)
        }
        return iso
    }

    private func shortDate(_ date: Date) -> String {
        let df = DateFormatter()
        df.dateStyle = .medium
        df.timeStyle = .short
        df.locale = Locale(identifier: "nb_NO")
        return df.string(from: date)
    }

    // MARK: - Data loading

    @MainActor
    private func loadCached() async {
        defer { loading = false }
        do {
            let cached = try await api.fetchLeadgridResearch(leadId: leadId)
            self.research = cached
        } catch {
            self.errorText = "Kunne ikke laste cached research: \(error.localizedDescription)"
        }
    }

    @MainActor
    private func rerun() async {
        running = true
        errorText = nil
        defer { running = false }
        do {
            let fresh = try await api.runLeadgridResearch(leadId: leadId)
            self.research = fresh
        } catch {
            self.errorText = "Research feilet: \(error.localizedDescription)"
        }
    }
}
