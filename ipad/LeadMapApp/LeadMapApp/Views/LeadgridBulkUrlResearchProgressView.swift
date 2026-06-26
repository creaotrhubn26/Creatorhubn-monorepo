// LeadgridBulkUrlResearchProgressView.swift
//
// Live-progress + result-banner for bulk-URL-research (mig 0351).
//
// Flow:
//   1. Brukeren limer inn N URLer i LeadgridImportSheet → kall startBulkUrlResearch.
//   2. Denne view monteres med batchId og poller hvert 2. sek til status er
//      ferdig (completed / partial / failed / cancelled).
//   3. Mens batchen kjører: progress-bar + counter + per-URL-liste m/ status-ikon.
//   4. Når ferdig: success-banner "X / Y leads lagt til på kartet" m/ breakdown +
//      4 knapper (Vis alle på kartet, Rediger feilet, Importer flere, Lukk).

import SwiftUI

@MainActor
struct LeadgridBulkUrlResearchProgressView: View {
    @Environment(AppState.self) private var appState
    @Binding var statusMessage: String?
    let batchId: String
    let totalUrls: Int
    /// Når brukeren ber om å starte en ny batch.
    let onStartOver: () -> Void
    /// Når brukeren vil lukke arket (Lukk).
    let onClose: () -> Void

    @State private var progress: BulkUrlBatchProgress?
    @State private var detail: BulkUrlBatchDetail?
    @State private var pollingTask: Task<Void, Never>?
    @State private var isCancelling = false
    @State private var hasZoomedToBounds = false

    // MARK: - Body

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 16) {
                headerCard
                if let p = progress {
                    if p.status.isActive {
                        runningCard(progress: p)
                    } else {
                        successBanner(p)
                    }
                } else {
                    ProgressView("Starter …").padding(.top, 24)
                        .frame(maxWidth: .infinity)
                }
                if let d = detail {
                    itemListCard(d)
                }
            }
            .padding()
        }
        .task {
            await startPolling()
        }
        .onDisappear {
            pollingTask?.cancel()
            pollingTask = nil
        }
    }

    // MARK: - Cards

    private var headerCard: some View {
        VStack(alignment: .leading, spacing: 6) {
            HStack {
                Image(systemName: "list.bullet.rectangle.portrait")
                    .foregroundStyle(.purple)
                Text("Bulk URL-research").font(.subheadline.bold())
            }
            Text("\(totalUrls) URL-er er sendt til Leadgrid Agent.")
                .font(.caption)
                .foregroundStyle(.secondary)
        }
    }

    private func runningCard(progress p: BulkUrlBatchProgress) -> some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack {
                ProgressView()
                    .controlSize(.small)
                    .tint(.purple)
                Text(counterLine(p))
                    .font(.title3.weight(.semibold))
                Spacer()
                if let eta = p.etaSeconds, eta > 0 {
                    Text("~\(eta)s igjen")
                        .font(.caption2.monospaced())
                        .foregroundStyle(.secondary)
                }
            }
            ProgressView(value: p.progress.fraction)
                .tint(.purple)
            HStack(spacing: 16) {
                badge(symbol: "checkmark.circle.fill", tint: .green,
                      label: "\(p.progress.completed) ferdig")
                if p.progress.failed > 0 {
                    badge(symbol: "exclamationmark.triangle.fill", tint: .red,
                          label: "\(p.progress.failed) feilet")
                }
                badge(symbol: "mappin.and.ellipse", tint: .purple,
                      label: "\(p.progress.pinned) pin")
            }
            .font(.caption)

            Button(role: .destructive) {
                Task { await cancel() }
            } label: {
                Label("Avbryt batch", systemImage: "stop.circle")
                    .frame(maxWidth: .infinity, minHeight: 40)
            }
            .buttonStyle(.bordered)
            .disabled(isCancelling)
        }
        .padding(14)
        .background(Color(.secondarySystemBackground), in: RoundedRectangle(cornerRadius: 12))
    }

    /// Counter-string — DETTE er signaturen Daniel ba om:
    /// "Behandler X av Y URL-er …" mens den kjører, og
    /// "X av Y leads lagt til på kartet" når den er ferdig.
    private func counterLine(_ p: BulkUrlBatchProgress) -> String {
        if p.status.isActive {
            return "Behandler \(p.progress.completed + p.progress.failed) av \(p.progress.total) URL-er …"
        }
        return "\(p.progress.pinned) av \(p.progress.total) leads lagt til på kartet"
    }

    private func successBanner(_ p: BulkUrlBatchProgress) -> some View {
        VStack(spacing: 16) {
            Image(systemName: p.status == .failed ? "exclamationmark.triangle.fill"
                  : "mappin.circle.fill")
                .font(.system(size: 64))
                .foregroundStyle(p.status == .failed ? .red : .green)
            Text(counterLine(p))
                .font(.title3.bold())
                .multilineTextAlignment(.center)
            if let d = detail {
                breakdownCard(d)
            }
            actionButtons
        }
        .padding(.top, 12)
        .frame(maxWidth: .infinity)
    }

    private func breakdownCard(_ d: BulkUrlBatchDetail) -> some View {
        let b = d.confidenceBreakdown
        return VStack(alignment: .leading, spacing: 8) {
            if b.exact > 0 {
                breakdownRow(symbol: "checkmark.circle.fill", tint: .green,
                             label: "\(b.exact) med eksakt lokasjon (Places-treff)")
            }
            if b.geocoded > 0 {
                breakdownRow(symbol: "location.fill", tint: .yellow,
                             label: "\(b.geocoded) geokodet (Brreg-adresse)")
            }
            if b.approximate > 0 {
                breakdownRow(symbol: "mappin.slash", tint: .orange,
                             label: "\(b.approximate) med by-sentroid")
            }
            if b.unknown > 0 {
                breakdownRow(symbol: "questionmark.circle", tint: .gray,
                             label: "\(b.unknown) uten lokasjon")
            }
            if b.failed > 0 {
                breakdownRow(symbol: "xmark.circle.fill", tint: .red,
                             label: "\(b.failed) feilet (uleselig / ingen company-info)")
            }
        }
        .padding(12)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Color(.secondarySystemBackground), in: RoundedRectangle(cornerRadius: 12))
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
                zoomMapToBatchBounds()
            } label: {
                Label("Vis alle på kartet", systemImage: "map")
                    .frame(maxWidth: .infinity, minHeight: 44)
            }
            .buttonStyle(.borderedProminent)
            .tint(.purple)

            HStack(spacing: 10) {
                Button {
                    onStartOver()
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

    // MARK: - Item-liste

    private func itemListCard(_ d: BulkUrlBatchDetail) -> some View {
        VStack(alignment: .leading, spacing: 0) {
            Text("URL-STATUS").font(.caption2.bold())
                .foregroundStyle(.secondary)
                .padding(.horizontal, 12).padding(.top, 12).padding(.bottom, 8)
            ForEach(d.items) { item in
                itemRow(item)
                Divider().padding(.leading, 38)
            }
        }
        .background(Color(.secondarySystemBackground), in: RoundedRectangle(cornerRadius: 12))
    }

    private func itemRow(_ item: BulkUrlBatchItem) -> some View {
        HStack(spacing: 10) {
            statusIcon(for: item)
                .frame(width: 22)
            VStack(alignment: .leading, spacing: 2) {
                Text(displayUrl(item.url))
                    .font(.callout.monospaced())
                    .lineLimit(1)
                    .truncationMode(.middle)
                if let result = item.researchResult?.companyProfile,
                   let name = result.name {
                    Text(name).font(.caption).foregroundStyle(.secondary)
                } else if let err = item.errorMessage, item.status == .failed {
                    Text(err).font(.caption).foregroundStyle(.red)
                        .lineLimit(2)
                }
            }
            Spacer()
            if item.hasPin {
                Image(systemName: "mappin.and.ellipse")
                    .foregroundStyle(.purple)
                    .font(.caption)
            }
        }
        .padding(12)
    }

    @ViewBuilder
    private func statusIcon(for item: BulkUrlBatchItem) -> some View {
        switch item.status {
        case .pending:
            Image(systemName: "hourglass")
                .foregroundStyle(.secondary)
        case .running:
            ProgressView().controlSize(.mini).tint(.purple)
        case .completed:
            Image(systemName: "checkmark.circle.fill")
                .foregroundStyle(.green)
        case .failed:
            Image(systemName: "xmark.circle.fill")
                .foregroundStyle(.red)
        case .skipped:
            Image(systemName: "minus.circle")
                .foregroundStyle(.secondary)
        }
    }

    private func displayUrl(_ u: String) -> String {
        guard let host = URL(string: u)?.host else { return u }
        return host
    }

    private func badge(symbol: String, tint: Color, label: String) -> some View {
        HStack(spacing: 4) {
            Image(systemName: symbol).foregroundStyle(tint)
            Text(label)
        }
    }

    // MARK: - Polling

    private func startPolling() async {
        pollingTask?.cancel()
        pollingTask = Task { [batchId, totalUrls] in
            // Første full-detail-load slik at item-listen rendrer fra starten
            await fetchDetail()
            while !Task.isCancelled {
                guard let api = appState.api else { return }
                do {
                    let p = try await api.pollBulkUrlResearchProgress(batchId: batchId)
                    await MainActor.run { self.progress = p }
                    if !p.status.isActive {
                        // Hent full detail én siste gang m/ slutt-state
                        await fetchDetail()
                        // Live-injekt pins direkte slik at MapScreen rendrer
                        // dem uten å vente på refreshAll
                        await injectPinsIntoMapIfNeeded()
                        // Trigg en endelig refreshAll i bakgrunn
                        Task { await appState.refreshAll() }
                        return
                    }
                    // Periodisk re-load av items for live ikon-bytter
                    await fetchDetail()
                } catch {
                    await MainActor.run {
                        statusMessage = "Poll-feil: \(error.localizedDescription)"
                    }
                }
                _ = totalUrls
                try? await Task.sleep(nanoseconds: 2_000_000_000)
            }
        }
    }

    private func fetchDetail() async {
        guard let api = appState.api else { return }
        do {
            let d = try await api.fetchBulkUrlResearchBatch(batchId: batchId)
            await MainActor.run { self.detail = d }
        } catch {
            // Stille — vi har progress-counter fra polling
        }
    }

    // MARK: - Actions

    private func cancel() async {
        guard let api = appState.api else { return }
        isCancelling = true
        defer { isCancelling = false }
        do {
            try await api.cancelBulkUrlBatch(batchId: batchId)
        } catch {
            await MainActor.run {
                statusMessage = "Avbryt feilet: \(error.localizedDescription)"
            }
        }
    }

    /// Inject committed pins direkte i AppState.leads slik at MapScreen kan
    /// tegne dem umiddelbart uten å vente på refreshAll.
    private func injectPinsIntoMapIfNeeded() async {
        guard let d = detail else { return }
        var added: [LeadModel] = []
        for item in d.items where item.hasPin && item.status == .completed {
            guard let id = item.draftLeadId,
                  let result = item.researchResult,
                  let loc = result.location,
                  let lat = loc.latitude,
                  let lng = loc.longitude
            else { continue }
            let profile = result.companyProfile
            let model = LeadModel(
                id: id,
                name: profile?.name ?? "Uten navn",
                company: profile?.company,
                category: nil,
                status: .unvisited,
                address: loc.address,
                postalCode: loc.postalCode,
                city: loc.city,
                country: loc.country,
                latitude: lat,
                longitude: lng,
                phone: profile?.phone,
                email: profile?.email,
                websiteUrl: profile?.website,
                instagramUrl: profile?.socials.instagram,
                linkedinUrl: profile?.socials.linkedin,
                googleRating: nil,
                googlePlaceId: nil,
                logoUrl: profile?.logoUrl,
                aiOpportunityScore: profile?.aiOpportunityScore,
                estimatedValue: nil,
                leadSource: "url_research",
                assignedUserId: nil,
                assignedUserName: nil,
                assignedUserEmail: nil,
                projectId: nil,
                lastVisitAt: nil,
                nextFollowUpAt: nil,
                nextAction: nil,
                tags: nil,
                notes: nil,
                createdAt: Date(),
                updatedAt: Date(),
                leadTemperature: nil,
                pipelineStage: nil,
                leadScore: nil,
                industryId: nil,
            )
            if !appState.leads.contains(where: { $0.id == id }) {
                added.append(model)
            }
        }
        if !added.isEmpty {
            appState.leads.append(contentsOf: added)
        }
    }

    /// Plasserer en notifikasjon som MapScreen lytter på for å zoome til
    /// bounding-box av alle nye pins.
    private func zoomMapToBatchBounds() {
        guard let d = detail else { return }
        let coords: [(Double, Double)] = d.items.compactMap { item in
            guard item.hasPin,
                  let loc = item.researchResult?.location,
                  let lat = loc.latitude,
                  let lng = loc.longitude
            else { return nil }
            return (lat, lng)
        }
        guard !coords.isEmpty else { return }
        let userInfo: [String: Any] = [
            "coordinates": coords.map { ["lat": $0.0, "lng": $0.1] },
            "batch_id": batchId,
        ]
        NotificationCenter.default.post(
            name: .leadgridBulkUrlBatchZoomToBounds,
            object: nil,
            userInfo: userInfo,
        )
        hasZoomedToBounds = true
        onClose()
    }
}

// MARK: - Notification name (lyttes på av MapScreen)

extension Notification.Name {
    /// Posted med userInfo: ["coordinates": [["lat": Double, "lng": Double]]]
    /// MapScreen reagerer ved å sette MKCoordinateRegion til bounding-box.
    static let leadgridBulkUrlBatchZoomToBounds = Notification.Name(
        "leadgridBulkUrlBatchZoomToBounds"
    )
}
