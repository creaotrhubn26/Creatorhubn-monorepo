// LeadgridFullIntelligenceSheet.swift
//
// Visualiserer 7-modulers «Full Intelligence Report» fra Role Room Agent
// Bridge (PR #859). Tre tilstander:
//   1. Tom (ingen rapport ennå) → "Generer rapport"
//   2. Lastet → 7 fargede seksjoner, urgency-prioritert
//   3. Re-generer/refresh fra toolbar
//
// Seksjonene rendres i denne rekkefølgen (high-urgency threat øverst,
// resten i normal lese-rekkefølge):
//   - Header (generert-tid + konfidens-badge)
//   - 🔴 Threat (hvis urgency == high)
//   - ✅ Merch-fit
//   - 👥 Competitors
//   - 🧭 SWOT
//   - ⚠️ Threat (hvis urgency != high)
//   - 🏢 Brreg
//   - 🌐 Website / Brand-profil
//   - 📧 Outreach-strategi
//
// Brreg/Website/SWOT/Outreach er fritt-skjema (AnyJSONValue) — vi
// traverserer ved visning så backend kan endre form uten å bryke iPad.

import SwiftUI

struct LeadgridFullIntelligenceSheet: View {
    let api: APIClient
    let leadId: String
    let leadName: String

    @Environment(\.dismiss) private var dismiss

    @State private var report: LeadgridFullIntelligence?
    @State private var loading = true
    @State private var generating = false
    @State private var errorText: String?

    var body: some View {
        NavigationStack {
            Group {
                if loading && report == nil {
                    VStack(spacing: 12) {
                        ProgressView()
                        Text("Henter rapport...")
                            .font(.caption)
                            .foregroundStyle(.secondary)
                    }
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
                } else if let r = report {
                    reportView(r)
                } else {
                    emptyState
                }
            }
            .navigationTitle(leadName)
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Lukk") { dismiss() }
                }
                ToolbarItem(placement: .confirmationAction) {
                    if report != nil {
                        Button {
                            Task { await refresh() }
                        } label: {
                            if generating {
                                ProgressView()
                            } else {
                                Image(systemName: "arrow.clockwise")
                            }
                        }
                        .disabled(generating)
                    }
                }
            }
        }
        .task { await load() }
    }

    // MARK: - Empty state

    @ViewBuilder
    private var emptyState: some View {
        VStack(spacing: 14) {
            Image(systemName: "sparkles.rectangle.stack")
                .font(.system(size: 60))
                .foregroundStyle(.purple)
            Text("Ingen rapport ennå")
                .font(.headline)
            Text("Claude orkestrerer brreg + website + competitors + merch-fit + threat + SWOT + outreach")
                .font(.caption)
                .foregroundStyle(.secondary)
                .multilineTextAlignment(.center)
            Button {
                Task { await generate() }
            } label: {
                if generating {
                    ProgressView()
                        .tint(.white)
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, 8)
                } else {
                    Label("Generer rapport", systemImage: "sparkles")
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, 8)
                }
            }
            .buttonStyle(.borderedProminent)
            .tint(.purple)
            .padding(.horizontal, 32)
            .disabled(generating)
            if let errorText {
                Text(errorText)
                    .foregroundStyle(.red)
                    .font(.caption)
            }
        }
        .padding()
    }

    // MARK: - Full report layout

    @ViewBuilder
    private func reportView(_ r: LeadgridFullIntelligence) -> some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 16) {
                // Header
                HStack {
                    Image(systemName: "checkmark.seal.fill")
                        .foregroundStyle(.green)
                    Text("Generert \(relativeDate(r.generatedAt))")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                    Spacer()
                    if let conf = r.overallConfidence {
                        Text("\(Int(conf * 100))% konfidens")
                            .font(.caption.bold())
                            .padding(.horizontal, 8)
                            .padding(.vertical, 3)
                            .background(confidenceColor(conf).opacity(0.2), in: Capsule())
                            .foregroundStyle(confidenceColor(conf))
                    }
                }
                .padding(.horizontal)

                // High-urgency threat øverst.
                if let t = r.threatAssessment, t.urgency == "high" {
                    threatSection(t).padding(.horizontal)
                }

                if let m = r.merchFit {
                    merchSection(m).padding(.horizontal)
                }

                if let c = r.competitors, !c.isEmpty {
                    competitorsSection(c).padding(.horizontal)
                }

                if let swot = r.swot?.value as? [String: Any], !swot.isEmpty {
                    swotSection(swot).padding(.horizontal)
                }

                // Threat hvis ikke vist øverst.
                if let t = r.threatAssessment, t.urgency != "high" {
                    threatSection(t).padding(.horizontal)
                }

                if let brreg = r.brreg?.value as? [String: Any], !brreg.isEmpty {
                    brregSection(brreg).padding(.horizontal)
                }

                if let web = r.website?.value as? [String: Any], !web.isEmpty {
                    websiteSection(web).padding(.horizontal)
                }

                if let out = r.outreach?.value as? [String: Any], !out.isEmpty {
                    outreachSection(out).padding(.horizontal)
                }

                if let errors = r.errors, !errors.isEmpty {
                    VStack(alignment: .leading, spacing: 4) {
                        Label("Delvis feil", systemImage: "exclamationmark.triangle")
                            .font(.caption.bold())
                            .foregroundStyle(.orange)
                        ForEach(Array(errors.keys.sorted()), id: \.self) { key in
                            Text("· \(key): \(errors[key] ?? "")")
                                .font(.caption2)
                                .foregroundStyle(.secondary)
                        }
                    }
                    .padding(.horizontal)
                }
            }
            .padding(.vertical)
        }
    }

    // MARK: - Sections

    @ViewBuilder
    private func threatSection(_ t: LeadgridThreatAssessment) -> some View {
        sectionCard(
            title: "Trussel-vurdering",
            icon: "exclamationmark.triangle.fill",
            color: urgencyColor(t.urgency)
        ) {
            VStack(alignment: .leading, spacing: 8) {
                HStack {
                    Text("Hastighet:").font(.caption.bold())
                    Text(t.urgency.uppercased())
                        .font(.caption.bold())
                        .padding(.horizontal, 6)
                        .padding(.vertical, 2)
                        .background(urgencyColor(t.urgency).opacity(0.2), in: Capsule())
                        .foregroundStyle(urgencyColor(t.urgency))
                }
                if !t.marketThreats.isEmpty {
                    Text("Trusler")
                        .font(.caption.bold())
                        .foregroundStyle(.secondary)
                    ForEach(t.marketThreats, id: \.self) { th in
                        Label(th, systemImage: "exclamationmark.octagon")
                            .font(.caption)
                    }
                }
                if !t.marketOpportunities.isEmpty {
                    Text("Muligheter")
                        .font(.caption.bold())
                        .foregroundStyle(.secondary)
                        .padding(.top, 4)
                    ForEach(t.marketOpportunities, id: \.self) { op in
                        Label(op, systemImage: "lightbulb")
                            .font(.caption)
                    }
                }
            }
        }
    }

    @ViewBuilder
    private func merchSection(_ m: LeadgridMerchFit) -> some View {
        sectionCard(
            title: "Tjeneste-match",
            icon: "checklist",
            color: .blue
        ) {
            VStack(alignment: .leading, spacing: 6) {
                HStack(spacing: 8) {
                    fitBadge("Video", on: m.fitsVideo)
                    fitBadge("Foto", on: m.fitsPhoto)
                    fitBadge("Brand", on: m.fitsBrand)
                    fitBadge("Strategi", on: m.fitsStrategy)
                }
                if let r = m.reasoning, !r.isEmpty {
                    Text(r)
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }
            }
        }
    }

    @ViewBuilder
    private func fitBadge(_ label: String, on: Bool) -> some View {
        HStack(spacing: 3) {
            Image(systemName: on ? "checkmark.circle.fill" : "xmark.circle")
                .font(.caption2)
            Text(label).font(.caption2.bold())
        }
        .padding(.horizontal, 6)
        .padding(.vertical, 3)
        .background((on ? Color.green : Color.gray).opacity(0.15), in: Capsule())
        .foregroundStyle(on ? Color.green : Color.gray)
    }

    @ViewBuilder
    private func competitorsSection(_ comps: [LeadgridCompetitor]) -> some View {
        sectionCard(
            title: "Konkurrenter (\(comps.count))",
            icon: "person.2.fill",
            color: .orange
        ) {
            VStack(alignment: .leading, spacing: 8) {
                ForEach(comps) { c in
                    VStack(alignment: .leading, spacing: 3) {
                        HStack {
                            Text(c.name).font(.caption.bold())
                            Spacer()
                            Text(c.threatLevel.uppercased())
                                .font(.caption2.bold())
                                .padding(.horizontal, 5)
                                .padding(.vertical, 1)
                                .background(threatLevelColor(c.threatLevel).opacity(0.2), in: Capsule())
                                .foregroundStyle(threatLevelColor(c.threatLevel))
                        }
                        if let pos = c.marketPosition {
                            Text(pos)
                                .font(.caption2)
                                .foregroundStyle(.secondary)
                        }
                        if let diffs = c.differentiators, !diffs.isEmpty {
                            Text("Skiller seg: " + diffs.joined(separator: ", "))
                                .font(.caption2)
                                .foregroundStyle(.green)
                        }
                        if let weak = c.weaknesses, !weak.isEmpty {
                            Text("Svakheter: " + weak.joined(separator: ", "))
                                .font(.caption2)
                                .foregroundStyle(.orange)
                        }
                    }
                    .padding(.vertical, 4)
                    Divider()
                }
            }
        }
    }

    @ViewBuilder
    private func swotSection(_ swot: [String: Any]) -> some View {
        sectionCard(
            title: "SWOT",
            icon: "square.grid.2x2.fill",
            color: .indigo
        ) {
            VStack(alignment: .leading, spacing: 6) {
                ForEach(["strengths", "weaknesses", "opportunities", "threats"], id: \.self) { key in
                    if let items = swot[key] as? [Any], !items.isEmpty {
                        Text(swotLabel(key))
                            .font(.caption.bold())
                            .foregroundStyle(swotColor(key))
                        ForEach(Array(items.enumerated()), id: \.offset) { _, item in
                            Text("· " + String(describing: item))
                                .font(.caption2)
                                .foregroundStyle(.secondary)
                        }
                    } else if let str = swot[key] as? String, !str.isEmpty {
                        Text(swotLabel(key) + ": " + str)
                            .font(.caption)
                            .foregroundStyle(swotColor(key))
                    }
                }
            }
        }
    }

    @ViewBuilder
    private func brregSection(_ brreg: [String: Any]) -> some View {
        sectionCard(
            title: "Brreg-data",
            icon: "building.2.fill",
            color: .gray
        ) {
            VStack(alignment: .leading, spacing: 3) {
                ForEach(Array(brreg.keys.sorted().prefix(10)), id: \.self) { key in
                    HStack(alignment: .top) {
                        Text(key)
                            .font(.caption2.bold())
                            .foregroundStyle(.secondary)
                            .frame(width: 120, alignment: .leading)
                        Text(String(describing: brreg[key] ?? ""))
                            .font(.caption2)
                            .lineLimit(2)
                    }
                }
            }
        }
    }

    @ViewBuilder
    private func websiteSection(_ web: [String: Any]) -> some View {
        sectionCard(
            title: "Brand-profil",
            icon: "globe",
            color: .blue
        ) {
            VStack(alignment: .leading, spacing: 4) {
                if let brand = web["brandName"] as? String {
                    Text(brand).font(.subheadline.bold())
                }
                if let industry = web["industry"] as? String {
                    Text("Bransje: \(industry)")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }
                if let desc = web["description"] as? String {
                    Text(desc)
                        .font(.caption)
                        .foregroundStyle(.secondary)
                        .lineLimit(4)
                }
                if let tone = web["toneOfVoice"] as? String {
                    Text("Tone: \(tone)")
                        .font(.caption2)
                        .foregroundStyle(.secondary)
                }
            }
        }
    }

    @ViewBuilder
    private func outreachSection(_ out: [String: Any]) -> some View {
        sectionCard(
            title: "Outreach-strategi",
            icon: "envelope.badge.fill",
            color: .purple
        ) {
            VStack(alignment: .leading, spacing: 4) {
                if let primary = out["primaryChannel"] as? String {
                    Text("Primær kanal: \(primary)")
                        .font(.caption.bold())
                }
                if let opening = out["openingLine"] as? String {
                    Text("Åpning: \(opening)")
                        .font(.caption)
                        .italic()
                }
                if let time = out["bestTime"] as? String {
                    Text("Beste tid: \(time)")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }
            }
        }
    }

    // MARK: - Section card chrome

    @ViewBuilder
    private func sectionCard<C: View>(
        title: String,
        icon: String,
        color: Color,
        @ViewBuilder content: () -> C
    ) -> some View {
        VStack(alignment: .leading, spacing: 6) {
            Label(title, systemImage: icon)
                .font(.subheadline.bold())
                .foregroundStyle(color)
            content()
        }
        .padding()
        .background(color.opacity(0.06), in: RoundedRectangle(cornerRadius: 12))
    }

    // MARK: - Color helpers

    private func confidenceColor(_ c: Double) -> Color {
        if c >= 0.75 { return .green }
        if c >= 0.5 { return .orange }
        return .red
    }

    private func urgencyColor(_ u: String) -> Color {
        switch u {
        case "high":   return .red
        case "medium": return .orange
        default:       return .blue
        }
    }

    private func threatLevelColor(_ t: String) -> Color {
        switch t {
        case "high":   return .red
        case "medium": return .orange
        default:       return .blue
        }
    }

    private func swotLabel(_ k: String) -> String {
        switch k {
        case "strengths":     return "Styrker"
        case "weaknesses":    return "Svakheter"
        case "opportunities": return "Muligheter"
        case "threats":       return "Trusler"
        default:              return k
        }
    }

    private func swotColor(_ k: String) -> Color {
        switch k {
        case "strengths":     return .green
        case "weaknesses":    return .orange
        case "opportunities": return .blue
        case "threats":       return .red
        default:              return .gray
        }
    }

    private func relativeDate(_ iso: String) -> String {
        let f = ISO8601DateFormatter()
        f.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        let d = f.date(from: iso) ?? ISO8601DateFormatter().date(from: iso)
        guard let d else { return iso }
        let secs = -d.timeIntervalSinceNow
        if secs < 60 { return "nå" }
        if secs < 3600 { return "\(Int(secs / 60))m siden" }
        if secs < 86400 { return "\(Int(secs / 3600))t siden" }
        return "\(Int(secs / 86400))d siden"
    }

    // MARK: - Loaders

    @MainActor
    private func load() async {
        loading = true
        do {
            report = try await api.fetchFullIntelligence(leadId: leadId)
        } catch {
            // Stille — empty state lar bruker generere ny rapport.
        }
        loading = false
    }

    @MainActor
    private func generate() async {
        generating = true
        errorText = nil
        do {
            report = try await api.generateFullIntelligence(leadId: leadId)
        } catch {
            errorText = "Kunne ikke generere: \(error.localizedDescription)"
        }
        generating = false
    }

    @MainActor
    private func refresh() async {
        generating = true
        errorText = nil
        do {
            report = try await api.refreshFullIntelligence(leadId: leadId)
        } catch {
            errorText = "Refresh feilet: \(error.localizedDescription)"
        }
        generating = false
    }
}
