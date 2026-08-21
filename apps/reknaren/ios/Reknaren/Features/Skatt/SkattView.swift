import SwiftUI

struct TaxReserveItem: Decodable, Identifiable, Sendable {
    let id: String
    let amountMinor: Money
    let reservedAt: String
    let note: String?
}

struct TaxReserveOverview: Decodable, Sendable {
    let asOf: String
    let estimatedTaxMinor: Money
    let recommendedReserveMinor: Money
    let reservedMinor: Money
    let paidAdvanceTaxMinor: Money
    let remainingMinor: Money
    let effectiveRatePer1000: Int
    let marginalRatePer1000: Int
    let reserves: [TaxReserveItem]

    var ratePct: String { String(format: "%.1f", Double(effectiveRatePer1000) / 10.0) }
    var marginalPct: String { String(format: "%.1f", Double(marginalRatePer1000) / 10.0) }
    /// Inntektsåret fra asOf (YYYY-…) — brukes i forklaringstekst.
    var year: String { String(asOf.prefix(4)) }
    var hasPaidAdvance: Bool { paidAdvanceTaxMinor.minor > 0 }
    var covered: Bool { recommendedReserveMinor.minor > 0 && remainingMinor.minor <= 0 }
    var progress: Double {
        guard recommendedReserveMinor.minor > 0 else { return 0 }
        // Både manuelt avsatt og allerede betalt forskuddsskatt teller mot målet.
        let dekket = reservedMinor.minor + paidAdvanceTaxMinor.minor
        return min(1, Double(dekket) / Double(recommendedReserveMinor.minor))
    }
}

@MainActor
@Observable
final class SkattViewModel {
    enum Load { case idle, loading, loaded(TaxReserveOverview), failed(String) }
    var load: Load = .idle
    var amountText: String = ""
    var saving = false
    var justCovered = false

    func fetch(orgId: String) async {
        if case .loaded = load {} else { load = .loading }
        do {
            let ov: TaxReserveOverview = try await APIClient.shared.get("/api/organizations/\(orgId)/tax/reserve-overview")
            load = .loaded(ov)
        } catch {
            load = .failed(error.localizedDescription)
        }
    }

    func register(orgId: String) async {
        let kroner = Int64(amountText.filter { $0.isNumber }) ?? 0
        guard kroner > 0 else { return }
        saving = true
        struct Body: Encodable { let amountMinor: String }
        let wasCovered = (currentOverview?.covered) ?? false
        do {
            let _: EmptyID = try await APIClient.shared.post(
                "/api/organizations/\(orgId)/tax/reserves", body: Body(amountMinor: String(kroner * 100)))
            amountText = ""
            await fetch(orgId: orgId)
            if let ov = currentOverview, ov.covered, !wasCovered { justCovered = true }
        } catch {
            load = .failed(error.localizedDescription)
        }
        saving = false
    }

    private var currentOverview: TaxReserveOverview? {
        if case .loaded(let ov) = load { return ov }
        return nil
    }
}

private struct EmptyID: Decodable, Sendable { let id: String? }

struct SkattView: View {
    let orgId: String
    @State private var model = SkattViewModel()

    var body: some View {
        Group {
            switch model.load {
            case .idle, .loading:
                ReidarView(style: .loading, caption: "Regner ut skatt…")
            case .failed(let msg):
                ContentUnavailableView("Kunne ikke hente", systemImage: "exclamationmark.triangle", description: Text(msg))
            case .loaded(let ov):
                List {
                    SkattHeader(ov: ov)
                    RegisterSection(model: model, orgId: orgId)
                    if !ov.reserves.isEmpty {
                        Section("Avsatt i år") {
                            ForEach(ov.reserves) { r in
                                HStack {
                                    VStack(alignment: .leading, spacing: 2) {
                                        Text(r.amountMinor.kr).font(.body.weight(.medium)).monospacedDigit()
                                        if let n = r.note { Text(n).font(.caption).foregroundStyle(.secondary) }
                                    }
                                    Spacer()
                                    Text(r.reservedAt).font(.caption).foregroundStyle(.secondary)
                                }
                            }
                        }
                    }
                }
            }
        }
        .navigationTitle("Skatt")
        .overlay { if model.justCovered { CoveredToast() } }
        .task(id: model.justCovered) {
            guard model.justCovered else { return }
            try? await Task.sleep(for: .seconds(2))
            model.justCovered = false
        }
        .task(id: orgId) { await model.fetch(orgId: orgId) }
        .refreshable { await model.fetch(orgId: orgId) }
    }
}

private struct SkattHeader: View {
    let ov: TaxReserveOverview
    var body: some View {
        Section {
            VStack(spacing: 14) {
                ReidarView(style: ov.covered ? .success : .idle, size: 96)
                Text(ov.covered ? "Alt er satt av 🎉" : "Sett av til skatt")
                    .font(.headline)
                Text(ov.recommendedReserveMinor.kr).font(.system(size: 34, weight: .bold)).monospacedDigit()
                Text("Anbefalt reserve i år · effektiv \(ov.ratePct) % · marginal \(ov.marginalPct) %")
                    .font(.footnote).foregroundStyle(.secondary).multilineTextAlignment(.center)
                ProgressView(value: ov.progress).tint(.reknarenGreen)
                HStack {
                    Label(ov.reservedMinor.kr, systemImage: "checkmark.circle").foregroundStyle(.green)
                    Spacer()
                    if !ov.covered {
                        Text("Gjenstår \(ov.remainingMinor.kr)").foregroundStyle(.orange)
                    }
                }
                .font(.caption).monospacedDigit()
                if ov.hasPaidAdvance {
                    Label("Allerede betalt forskuddsskatt: \(ov.paidAdvanceTaxMinor.kr)", systemImage: "banknote")
                        .font(.caption).foregroundStyle(.secondary).monospacedDigit()
                }
            }
            .padding(.vertical, 6)
        } footer: {
            Text("Estimert skatt \(ov.estimatedTaxMinor.kr) (22 % alminnelig inntekt + trygdeavgift + trinnskatt med \(ov.year)-satser). Anslag — annen inntekt (lønn/pensjon) og personfradrag er ikke medregnet. Reknaren flytter ingen penger; du overfører selv til skattekonto og registrerer beløpet her.")
        }
    }
}

private struct RegisterSection: View {
    @Bindable var model: SkattViewModel
    let orgId: String
    var body: some View {
        Section("Registrer at du har satt av") {
            HStack {
                TextField("Beløp i kr", text: $model.amountText)
                    .keyboardType(.numberPad)
                Text("kr").foregroundStyle(.secondary)
            }
            Button {
                Task { await model.register(orgId: orgId) }
            } label: {
                if model.saving { ProgressView() } else { Label("Registrer avsatt beløp", systemImage: "plus.circle") }
            }
            .disabled(model.saving || model.amountText.filter(\.isNumber).isEmpty)
        }
    }
}

private struct CoveredToast: View {
    var body: some View {
        VStack(spacing: 10) {
            ReidarView(style: .success, size: 96)
            Text("Du har satt av nok til skatt!").font(.headline).multilineTextAlignment(.center)
        }
        .padding(24)
        .background(.regularMaterial, in: RoundedRectangle(cornerRadius: 20, style: .continuous))
        .shadow(color: .black.opacity(0.15), radius: 20, y: 8)
        .padding(40)
        .transition(.scale.combined(with: .opacity))
    }
}
