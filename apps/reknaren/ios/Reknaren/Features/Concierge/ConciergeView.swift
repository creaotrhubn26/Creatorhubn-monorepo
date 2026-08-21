import SwiftUI

@MainActor
@Observable
final class ConciergeViewModel {
    enum Load { case idle, loading, loaded([PaymentGap]), failed(String) }
    var load: Load = .idle
    var linkingId: String?
    var celebrate = false   // «Bokført!»-feiring etter vellykket bokføring

    private func todayISO() -> String {
        let f = DateFormatter(); f.dateFormat = "yyyy-MM-dd"; f.timeZone = TimeZone(identifier: "Europe/Oslo")
        return f.string(from: Date())
    }

    func fetch(orgId: String) async {
        load = .loading
        do {
            let hunt: DocumentHunt = try await APIClient.shared.get("/api/organizations/\(orgId)/document-hunt?asOf=\(todayISO())")
            load = .loaded(hunt.gaps)
        } catch {
            load = .failed(error.localizedDescription)
        }
    }

    /// Ett trykk: koble kvitteringen til betalingen og bokføre (samme endepunkt som web).
    func approve(orgId: String, gap: PaymentGap) async {
        guard let doc = gap.topCandidate else { return }
        linkingId = gap.transactionId
        struct Body: Encodable { let transactionId: String; let documentId: String }
        do {
            let _: Empty = try await APIClient.shared.post(
                "/api/organizations/\(orgId)/document-hunt/link",
                body: Body(transactionId: gap.transactionId, documentId: doc.documentId))
            if case .loaded(var gaps) = load {
                gaps.removeAll { $0.transactionId == gap.transactionId }
                load = .loaded(gaps)
            }
            celebrate = true
        } catch {
            load = .failed(error.localizedDescription)
        }
        linkingId = nil
    }
}

/// «Reknaren fant kvitteringen — legg i regnskapet?» Proaktiv konsierge: betalinger
/// der vi automatisk fant en sannsynlig kvittering, klare for ett-trykks bokføring.
struct ConciergeView: View {
    let orgId: String
    @State private var model = ConciergeViewModel()

    var body: some View {
        Group {
            switch model.load {
            case .idle, .loading:
                ReidarView(style: .loading, caption: "Ser etter kvitteringer…")
            case .failed(let msg):
                ContentUnavailableView("Kunne ikke hente", systemImage: "exclamationmark.triangle", description: Text(msg))
            case .loaded(let gaps) where gaps.isEmpty:
                VStack(spacing: 14) {
                    ReidarView(style: .success, size: 120)
                    Text("Alt er i orden").font(.title3.weight(.semibold))
                    Text("Ingen betalinger venter på kvittering akkurat nå.")
                        .font(.subheadline).foregroundStyle(.secondary).multilineTextAlignment(.center)
                }
                .padding()
            case .loaded(let gaps):
                List(gaps) { gap in NudgeRow(gap: gap, linking: model.linkingId == gap.transactionId) {
                    Task { await model.approve(orgId: orgId, gap: gap) }
                } }
                .listStyle(.insetGrouped)
            }
        }
        .navigationTitle("Til godkjenning")
        .overlay { if model.celebrate { CelebrateToast() } }
        .task(id: model.celebrate) {
            guard model.celebrate else { return }
            try? await Task.sleep(for: .seconds(1.8))
            model.celebrate = false
        }
        .task(id: orgId) { await model.fetch(orgId: orgId) }
        .refreshable { await model.fetch(orgId: orgId) }
    }
}

/// Kort feiring når et bilag er bokført — Reidar gir tommel opp.
private struct CelebrateToast: View {
    var body: some View {
        VStack(spacing: 10) {
            ReidarView(style: .success, size: 96)
            Text("Bokført!").font(.headline)
        }
        .padding(24)
        .background(.regularMaterial, in: RoundedRectangle(cornerRadius: 20, style: .continuous))
        .shadow(color: .black.opacity(0.15), radius: 20, y: 8)
        .transition(.scale.combined(with: .opacity))
    }
}

private struct NudgeRow: View {
    let gap: PaymentGap
    let linking: Bool
    let onApprove: () -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text("Du betalte \(gap.amountMinor.kr) til \(gap.counterparty ?? gap.description)")
                .font(.subheadline.weight(.medium))
            if let c = gap.topCandidate {
                Text("Vi fant kvitteringen \(c.vendor.map { "fra \($0)" } ?? "")\(c.dateText.map { " (\($0))" } ?? "") i bilagene dine.")
                    .font(.footnote).foregroundStyle(.secondary)
                if let reason = c.reasons.first {
                    Text(reason).font(.caption).foregroundStyle(.secondary)
                }
            }
            HStack {
                Button(action: onApprove) {
                    if linking { ProgressView() } else { Text("Ja, bokfør").frame(maxWidth: .infinity) }
                }
                .buttonStyle(.borderedProminent)
                .disabled(linking)
            }
        }
        .padding(.vertical, 4)
    }
}
