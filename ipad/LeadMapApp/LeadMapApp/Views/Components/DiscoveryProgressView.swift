// DiscoveryProgressView.swift
//
// Live progress-UI for "Finn leads"-flyten i Research-tab.
//
// Erstatter den generiske spinneren med en stage-by-stage flyt:
//
//   Stage 1 — Søker kandidater
//     "🔍 Søker etter [bransje] i [by] …"
//     "Vi spør Google Places om bedrifter som matcher … innenfor 10 km."
//     ⏱️ 00:08 brukt   [ProgressView, ubestemt]
//
//   Stage 2 — Fant N kandidater
//     "✅ Fant 10 kandidater"
//     "Starter research på hver av dem — Brreg, nettside, kontaktinfo."
//     ⏱️ 00:12 brukt
//
//   Stage 3 — Researcher (m/ per-URL-liste, gjenbrukt fra
//             LeadgridBulkUrlResearchProgressView-mønsteret)
//     "🔬 Researcher 3 av 10"
//     ⏱️ 01:24 brukt · ~01:30 igjen
//     Per-URL liste m/ status-ikon (pending/running/completed/failed)
//
//   Stage 4 — Suksess-hero
//     "🎉 Vi fant 8 leads for {prosjekt}!"
//     ⏱️ 02:46 totalt
//     Breakdown (eksakt / geokodet / by-sentroid / feilet)
//
// Self-contained — binder kun mot DiscoveryRunState. Eier IKKE polling-
// loopen (det gjør FindLeadsSegment); view-en eier kun elapsed-tick-Task
// og rullerende tips-rotasjon.

import SwiftUI

@MainActor
struct DiscoveryProgressView: View {
    @Bindable var state: DiscoveryRunState
    /// Forklarende bransje/by-streng vi viser i stage 1 ("fotograf i Oslo").
    /// Brukes også i stage 1-subtitle. Settes fra caller idet POST trigges.
    let discoveryQueryHint: String?
    /// Radius i km — kun vist i stage 1 hvis geo brukes. nil = ingen radius.
    let radiusKmHint: Int?
    /// Avbryt-callback (knappen vises i stage 1-3 så lenge vi har batchId).
    let onCancel: () -> Void
    /// "Vis alle på kartet"-callback (vises i success-hero).
    let onShowOnMap: () -> Void
    /// "Importer flere"-callback (vises i success-hero).
    let onImportMore: () -> Void
    /// "Lukk"-callback (vises i success-hero).
    let onClose: () -> Void

    private static let brandPurple = Color(red: 0.58, green: 0.20, blue: 0.92)

    private static let runningTips: [String] = [
        "Brreg-API er ofte tregest — 10-20 sek per oppslag.",
        "Google Places gir oss adresse + telefon på sekunder.",
        "Claude analyserer hver nettside for bransje-context.",
        "Vi cacher resultatene — neste gang går det fortere.",
    ]

    var body: some View {
        VStack(alignment: .leading, spacing: 14) {
            switch state.stage {
            case .idle:
                EmptyView()
            case .starting:
                stage1Card
            case .foundCandidates(let n):
                stage2Card(candidates: n)
            case .processing, .finalizing:
                stage3Card
            case .success(let summary):
                stage4Card(summary: summary)
            case .failed(let message):
                failedCard(message: message)
            }
        }
        .task(id: state.startedAt) {
            // Tick elapsedSeconds hvert sekund så lenge vi er i en
            // running stage. Stopper når success/failed/idle nås.
            await tickElapsed()
        }
    }

    // MARK: - Stage 1 — Søker kandidater

    @ViewBuilder
    private var stage1Card: some View {
        progressShell {
            StageHeader(
                icon: "magnifyingglass",
                title: stage1Title,
                subtitle: stage1Subtitle,
                tint: Self.brandPurple,
            )
            timeRow
            ProgressView()
                .progressViewStyle(.linear)
                .tint(Self.brandPurple)
            tipsRowIfDue
            cancelButtonIfPossible
        }
    }

    private var stage1Title: String {
        if let q = discoveryQueryHint, !q.isEmpty {
            return "Søker etter \(q) …"
        }
        return "Søker etter kandidater …"
    }

    private var stage1Subtitle: String {
        let what = discoveryQueryHint?.isEmpty == false
            ? "'\(discoveryQueryHint!)'"
            : "prosjektets bransje + by"
        let radius = radiusKmHint.map { " innenfor \($0) km" } ?? ""
        return "Vi spør Google Places om bedrifter som matcher \(what)\(radius)."
    }

    // MARK: - Stage 2 — Fant N kandidater

    @ViewBuilder
    private func stage2Card(candidates: Int) -> some View {
        progressShell {
            StageHeader(
                icon: "checkmark.circle.fill",
                title: candidates > 0
                    ? "Fant \(candidates) kandidater"
                    : "Fant ingen kandidater",
                subtitle: candidates > 0
                    ? "Starter research på hver av dem — Brreg, nettside, kontaktinfo."
                    : "Prøv en bredere bransje eller større radius.",
                tint: Self.brandPurple,
            )
            timeRow
            if candidates > 0 {
                ProgressView()
                    .progressViewStyle(.linear)
                    .tint(Self.brandPurple)
            }
            tipsRowIfDue
            cancelButtonIfPossible
        }
    }

    // MARK: - Stage 3 — Researcher per-URL

    @ViewBuilder
    private var stage3Card: some View {
        progressShell {
            StageHeader(
                icon: "flask.fill",
                title: stage3Title,
                subtitle: stage3Subtitle,
                tint: Self.brandPurple,
            )
            ProgressView(value: state.fraction)
                .tint(Self.brandPurple)
            timeRowWithEta
            badgesRow
            itemListCard
            tipsRowIfDue
            cancelButtonIfPossible
        }
    }

    private var stage3Title: String {
        let done = state.completed + state.failed
        return "Researcher \(done) av \(state.total)"
    }

    private var stage3Subtitle: String {
        if case .finalizing = state.stage {
            return "Fullfører siste pin-er og henter breakdown …"
        }
        return "Slår opp i Brreg, henter nettside, finner Places-koordinater."
    }

    @ViewBuilder
    private var itemListCard: some View {
        if !state.items.isEmpty {
            VStack(spacing: 0) {
                ForEach(visibleItems) { item in
                    itemRow(item)
                    if item.id != visibleItems.last?.id {
                        Divider().padding(.leading, 34)
                    }
                }
                if state.items.count > visibleItems.count {
                    Divider().padding(.leading, 34)
                    HStack {
                        Image(systemName: "ellipsis")
                            .foregroundStyle(.secondary)
                            .frame(width: 22)
                        Text("+ \(state.items.count - visibleItems.count) til i kø")
                            .font(.caption)
                            .foregroundStyle(.secondary)
                        Spacer()
                    }
                    .padding(10)
                }
            }
            .background(Color(.tertiarySystemBackground),
                         in: RoundedRectangle(cornerRadius: 10))
        }
    }

    /// Vis maks 8 items inline — resten oppsummeres i en "+ N til i kø"-rad
    /// for å unngå at progress-kortet blir veldig høyt i 50-leads-flyten.
    private var visibleItems: [BulkUrlBatchItem] {
        // Prioritér running/completed/failed øverst (rekkefølgen brukeren
        // bryr seg om), så pending nederst. Stable-sort på orderIndex internt.
        let priority: (BulkUrlBatchItem) -> Int = { item in
            switch item.status {
            case .running: return 0
            case .completed, .failed, .skipped: return 1
            case .pending: return 2
            }
        }
        let sorted = state.items.sorted { a, b in
            let pa = priority(a)
            let pb = priority(b)
            if pa != pb { return pa < pb }
            return a.orderIndex < b.orderIndex
        }
        return Array(sorted.prefix(8))
    }

    private func itemRow(_ item: BulkUrlBatchItem) -> some View {
        HStack(spacing: 10) {
            statusIcon(for: item).frame(width: 22)
            VStack(alignment: .leading, spacing: 1) {
                Text(displayUrl(item.url))
                    .font(.caption.monospaced())
                    .lineLimit(1)
                    .truncationMode(.middle)
                Text(itemSubtitle(item))
                    .font(.caption2)
                    .foregroundStyle(.secondary)
                    .lineLimit(1)
            }
            Spacer()
            if item.hasPin {
                Image(systemName: "mappin.and.ellipse")
                    .foregroundStyle(Self.brandPurple)
                    .font(.caption2)
            }
        }
        .padding(.horizontal, 10)
        .padding(.vertical, 8)
    }

    @ViewBuilder
    private func statusIcon(for item: BulkUrlBatchItem) -> some View {
        switch item.status {
        case .pending:
            Image(systemName: "hourglass")
                .foregroundStyle(.secondary)
                .font(.caption)
        case .running:
            ProgressView()
                .controlSize(.mini)
                .tint(Self.brandPurple)
        case .completed:
            Image(systemName: "checkmark.circle.fill")
                .foregroundStyle(.green)
                .font(.caption)
        case .failed:
            Image(systemName: "xmark.circle.fill")
                .foregroundStyle(.red)
                .font(.caption)
        case .skipped:
            Image(systemName: "minus.circle")
                .foregroundStyle(.secondary)
                .font(.caption)
        }
    }

    private func itemSubtitle(_ item: BulkUrlBatchItem) -> String {
        switch item.status {
        case .pending:  return "Venter …"
        case .running:  return "Henter nettside …"
        case .completed:
            switch item.locationConfidence {
            case .exact:        return "Pin'et (eksakt)"
            case .geocoded:     return "Pin'et (geokodet)"
            case .approximate:  return "Pin'et (by-sentroid)"
            case .unknown:      return "Ferdig, ingen pin"
            case .none:         return "Ferdig"
            }
        case .failed:
            return item.errorMessage ?? "Feilet"
        case .skipped:
            return "Hoppet over"
        }
    }

    private func displayUrl(_ u: String) -> String {
        URL(string: u)?.host ?? u
    }

    // MARK: - Stage 4 — Suksess-hero

    @ViewBuilder
    private func stage4Card(summary: DiscoverySuccessSummary) -> some View {
        let projectLine = summary.projectName ?? "prosjektet"
        let tintFor = summary.totalPinned > 0 ? Self.brandPurple : Color.orange
        VStack(spacing: 16) {
            Image(systemName: summary.totalPinned > 0
                  ? "mappin.circle.fill" : "exclamationmark.triangle.fill")
                .font(.system(size: 56))
                .foregroundStyle(tintFor)

            Text(summary.totalPinned > 0
                 ? "Vi fant \(summary.totalPinned) leads for \(projectLine)!"
                 : "Ingen leads kunne pinned for \(projectLine).")
                .font(.title3.bold())
                .multilineTextAlignment(.center)

            HStack(spacing: 6) {
                Image(systemName: "clock")
                    .font(.caption)
                Text("\(formatDuration(summary.totalDurationSeconds)) totalt")
                    .font(.caption.monospacedDigit())
            }
            .foregroundStyle(.secondary)

            breakdownCard(summary.breakdown)
            actionButtons
        }
        .padding(20)
        .frame(maxWidth: .infinity)
        .background(.regularMaterial,
                     in: RoundedRectangle(cornerRadius: 18))
        .overlay(
            RoundedRectangle(cornerRadius: 18)
                .stroke(Self.brandPurple.opacity(0.30), lineWidth: 1)
        )
        .shadow(color: .black.opacity(0.15), radius: 10, x: 0, y: 4)
    }

    private func breakdownCard(_ b: DiscoveryConfidenceBreakdown) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            if b.exact > 0 {
                breakdownRow(symbol: "checkmark.circle.fill", tint: .green,
                             label: "\(b.exact) med eksakt lokasjon (Google Places)")
            }
            if b.geocoded > 0 {
                breakdownRow(symbol: "location.fill", tint: .yellow,
                             label: "\(b.geocoded) geokodet (Brreg-adresse)")
            }
            if b.approximate > 0 {
                breakdownRow(symbol: "mappin.slash", tint: .orange,
                             label: "\(b.approximate) by-sentroid (manuell verifisering anbefales)")
            }
            if b.unknown > 0 {
                breakdownRow(symbol: "questionmark.circle", tint: .gray,
                             label: "\(b.unknown) uten lokasjon")
            }
            if b.failed > 0 {
                breakdownRow(symbol: "xmark.circle.fill", tint: .red,
                             label: "\(b.failed) feilet")
            }
        }
        .padding(12)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Color(.secondarySystemBackground),
                     in: RoundedRectangle(cornerRadius: 12))
    }

    private func breakdownRow(symbol: String, tint: Color, label: String) -> some View {
        HStack(spacing: 10) {
            Image(systemName: symbol).foregroundStyle(tint).frame(width: 22)
            Text(label).font(.callout)
            Spacer()
        }
    }

    private var actionButtons: some View {
        VStack(spacing: 10) {
            Button {
                onShowOnMap()
            } label: {
                Label("Vis alle på kartet", systemImage: "map")
                    .font(.headline)
                    .frame(maxWidth: .infinity, minHeight: 48)
            }
            .buttonStyle(.borderedProminent)
            .tint(Self.brandPurple)

            HStack(spacing: 10) {
                Button {
                    onImportMore()
                } label: {
                    Label("Importer flere", systemImage: "plus.circle")
                        .frame(maxWidth: .infinity, minHeight: 40)
                }
                .buttonStyle(.bordered)

                Button {
                    onClose()
                } label: {
                    Text("Lukk").frame(maxWidth: .infinity, minHeight: 40)
                }
                .buttonStyle(.bordered)
            }
        }
    }

    // MARK: - Failed

    @ViewBuilder
    private func failedCard(message: String) -> some View {
        VStack(spacing: 14) {
            Image(systemName: "exclamationmark.triangle.fill")
                .font(.system(size: 44))
                .foregroundStyle(.red)
            Text("Discovery feilet")
                .font(.headline)
            Text(message)
                .font(.callout)
                .multilineTextAlignment(.center)
                .foregroundStyle(.secondary)
            Button {
                onClose()
            } label: {
                Text("Lukk").frame(maxWidth: .infinity, minHeight: 44)
            }
            .buttonStyle(.bordered)
        }
        .padding(18)
        .frame(maxWidth: .infinity)
        .background(Color.red.opacity(0.06),
                     in: RoundedRectangle(cornerRadius: 14))
        .overlay(
            RoundedRectangle(cornerRadius: 14)
                .stroke(Color.red.opacity(0.30), lineWidth: 1)
        )
    }

    // MARK: - Shared sub-views

    /// "⏱️ MM:SS brukt"-rad (uten ETA — for stage 1/2 hvor pace ikke er kjent).
    private var timeRow: some View {
        HStack(spacing: 6) {
            Image(systemName: "clock")
                .font(.caption2)
                .foregroundStyle(.secondary)
            Text("\(state.formattedElapsed()) brukt")
                .font(.caption.monospacedDigit())
                .foregroundStyle(.secondary)
            Spacer()
        }
    }

    /// "⏱️ MM:SS brukt · ~MM:SS igjen" — stage 3 hvor vi har pace.
    private var timeRowWithEta: some View {
        HStack(spacing: 6) {
            Image(systemName: "clock")
                .font(.caption2)
                .foregroundStyle(.secondary)
            Text("\(state.formattedElapsed()) brukt")
                .font(.caption.monospacedDigit())
                .foregroundStyle(.secondary)
            if let eta = state.formattedEta() {
                Text("·")
                    .font(.caption2)
                    .foregroundStyle(.tertiary)
                Text("~\(eta) igjen")
                    .font(.caption.monospacedDigit())
                    .foregroundStyle(.secondary)
            }
            Spacer()
        }
    }

    private var badgesRow: some View {
        HStack(spacing: 14) {
            badge(icon: "checkmark.circle.fill", tint: .green,
                  label: "\(state.completed) ferdig")
            if state.failed > 0 {
                badge(icon: "xmark.circle.fill", tint: .red,
                      label: "\(state.failed) feilet")
            }
            badge(icon: "mappin.and.ellipse", tint: Self.brandPurple,
                  label: "\(state.pinned) pin")
        }
        .font(.caption)
    }

    private func badge(icon: String, tint: Color, label: String) -> some View {
        HStack(spacing: 4) {
            Image(systemName: icon).foregroundStyle(tint)
            Text(label)
        }
    }

    /// Vis rullerende tips kun etter 30s — kortere kjøringer trenger ikke
    /// støy-fri kontekst.
    @ViewBuilder
    private var tipsRowIfDue: some View {
        if state.elapsedSeconds >= 30 {
            RollingTipText(tips: Self.runningTips)
                .padding(.top, 2)
        }
    }

    @ViewBuilder
    private var cancelButtonIfPossible: some View {
        if state.batchId != nil {
            Button(role: .destructive) {
                onCancel()
            } label: {
                Label("Avbryt", systemImage: "stop.circle")
                    .frame(maxWidth: .infinity, minHeight: 40)
            }
            .buttonStyle(.bordered)
        }
    }

    // MARK: - Shell + tick

    @ViewBuilder
    private func progressShell<Content: View>(@ViewBuilder _ content: () -> Content) -> some View {
        VStack(alignment: .leading, spacing: 12) {
            content()
        }
        .padding(16)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(
            LinearGradient(
                colors: [
                    Self.brandPurple.opacity(0.12),
                    Self.brandPurple.opacity(0.04),
                ],
                startPoint: .topLeading,
                endPoint: .bottomTrailing,
            ),
            in: RoundedRectangle(cornerRadius: 16),
        )
        .overlay(
            RoundedRectangle(cornerRadius: 16)
                .stroke(Self.brandPurple.opacity(0.25), lineWidth: 1),
        )
    }

    /// Tikk elapsedSeconds hvert sekund så lenge en stage er aktiv.
    /// Avhengig av state.startedAt + state.stage.isRunning. Stopper
    /// automatisk når .success/.failed nås.
    private func tickElapsed() async {
        while !Task.isCancelled {
            guard let start = state.startedAt, state.stage.isRunning else { return }
            state.elapsedSeconds = Int(Date().timeIntervalSince(start))
            state.updateETA()
            try? await Task.sleep(nanoseconds: 1_000_000_000)
        }
    }

    private func formatDuration(_ seconds: Int) -> String {
        let safe = max(0, seconds)
        let m = safe / 60
        let s = safe % 60
        return String(format: "%02d:%02d", m, s)
    }
}
