import SwiftUI

struct SaldoGroupInfo: Decodable, Sendable { let name: String; let ratePct: Int }

struct FixedAsset: Decodable, Identifiable, Sendable {
    let id: String
    let name: String
    let saldoGroup: String
    let acquisitionDate: String
    let costMinor: Money
    let ledgerAccount: String
    let status: String       // active | disposed | expensed
    let disposalDate: String?
    let notes: String?
}

struct FixedAssetsResponse: Decodable, Sendable {
    let groups: [String: SaldoGroupInfo]
    let assets: [FixedAsset]
}

struct DepreciationGroupRow: Decodable, Identifiable, Sendable {
    let group: String
    let name: String
    let ratePct: Int
    let depreciationThisYearMinor: Money
    let closingSaldoMinor: Money
    var id: String { group }
}

struct DepreciationResult: Decodable, Sendable {
    let year: Int
    let groups: [DepreciationGroupRow]
    let totalDepreciationThisYearMinor: Money
    let totalClosingSaldoMinor: Money
    let notes: [String]
}

@MainActor
@Observable
final class FixedAssetsViewModel {
    enum Load { case idle, loading, loaded, failed(String) }
    var load: Load = .idle
    var groups: [String: SaldoGroupInfo] = [:]
    var assets: [FixedAsset] = []
    var depreciation: DepreciationResult?

    func fetch(orgId: String) async {
        load = .loading
        do {
            let r: FixedAssetsResponse = try await APIClient.shared.get("/api/organizations/\(orgId)/fixed-assets")
            groups = r.groups
            assets = r.assets
            // Årets avskrivning (best-effort; egen feil skjuler ikke listen).
            depreciation = try? await APIClient.shared.get("/api/organizations/\(orgId)/fixed-assets/depreciation")
            load = .loaded
        } catch {
            load = .failed(error.localizedDescription)
        }
    }
}

struct FixedAssetsView: View {
    let orgId: String
    @State private var model = FixedAssetsViewModel()

    var body: some View {
        Group {
            switch model.load {
            case .idle, .loading:
                ProgressView("Henter anleggsmidler…")
            case .failed(let msg):
                ContentUnavailableView("Kunne ikke hente", systemImage: "exclamationmark.triangle", description: Text(msg))
            case .loaded where model.assets.isEmpty:
                ContentUnavailableView("Ingen anleggsmidler", systemImage: "shippingbox",
                                       description: Text("Kjøp over 15 000 kr med varig verdi føres som anleggsmiddel og avskrives. Registrer dem i web-appen."))
            case .loaded:
                List {
                    if let d = model.depreciation { DepreciationSummary(result: d) }
                    Section("Anleggsmidler") {
                        ForEach(model.assets) { asset in
                            FixedAssetRow(asset: asset, groupName: model.groups[asset.saldoGroup]?.name)
                        }
                    }
                }
            }
        }
        .navigationTitle("Anleggsmidler")
        .task(id: orgId) { await model.fetch(orgId: orgId) }
        .refreshable { await model.fetch(orgId: orgId) }
    }
}

private struct DepreciationSummary: View {
    let result: DepreciationResult
    var body: some View {
        Section("Avskrivning \(String(result.year))") {
            HStack {
                Text("Årets avskrivning").font(.subheadline)
                Spacer()
                Text(result.totalDepreciationThisYearMinor.kr).font(.subheadline.weight(.semibold)).monospacedDigit()
            }
            HStack {
                Text("Restsaldo ved årsslutt").font(.caption).foregroundStyle(.secondary)
                Spacer()
                Text(result.totalClosingSaldoMinor.kr).font(.caption).monospacedDigit().foregroundStyle(.secondary)
            }
            ForEach(result.groups.filter { $0.depreciationThisYearMinor.minor != 0 }) { g in
                HStack {
                    Text("\(g.name) (\(g.ratePct)%)").font(.caption).lineLimit(1)
                    Spacer()
                    Text(g.depreciationThisYearMinor.kr).font(.caption).monospacedDigit().foregroundStyle(.secondary)
                }
            }
        }
    }
}

private struct FixedAssetRow: View {
    let asset: FixedAsset
    let groupName: String?

    private var statusText: String {
        switch asset.status {
        case "disposed": return "Solgt"
        case "expensed": return "Kostnadsført"
        default: return "Aktiv"
        }
    }
    private var statusTint: Color { asset.status == "active" ? .green : .secondary }

    var body: some View {
        VStack(alignment: .leading, spacing: 4) {
            HStack {
                Text(asset.name).font(.body.weight(.medium)).lineLimit(1)
                Spacer()
                Text(asset.costMinor.kr).font(.body.weight(.semibold)).monospacedDigit()
            }
            HStack(spacing: 8) {
                Text(statusText).font(.caption2)
                    .padding(.horizontal, 6).padding(.vertical, 1)
                    .background(statusTint.opacity(0.16), in: Capsule()).foregroundStyle(statusTint)
                if let g = groupName { Text(g).font(.caption).foregroundStyle(.secondary).lineLimit(1) }
            }
            Text("Anskaffet \(asset.acquisitionDate)").font(.caption2).foregroundStyle(.secondary)
        }
        .padding(.vertical, 2)
    }
}
