import SwiftUI

struct PurchaseCategory: Decodable, Identifiable, Sendable {
    let accountNumber: String
    let name: String
    let taxDeductible: String
    var id: String { accountNumber }
}

struct PurchaseResult: Decodable, Sendable {
    let accountName: String
    let taxDeductible: String
    let businessAmountMinor: Money
    let privateAmountMinor: Money
    let taxReductionMinor: Money
    var deductible: Bool { taxDeductible == "yes" }
    var hasPrivateShare: Bool { privateAmountMinor.minor > 0 }
}

@MainActor
@Observable
final class KjopViewModel {
    var categories: [PurchaseCategory] = []
    var amountText = ""
    var description = ""
    var selected: String = "6551"
    var paidPrivately = true
    /// Andel næringsbruk (1–100). Under 100 = delvis privat, kun næringsdelen gir fradrag.
    var businessSharePct: Double = 100
    var saving = false
    var result: PurchaseResult?
    var errorText: String?

    func loadCategories(orgId: String) async {
        if let c = try? await APIClient.shared.get("/api/organizations/\(orgId)/purchase-categories") as [PurchaseCategory] {
            categories = c
            if let first = c.first { selected = first.accountNumber }
        }
    }

    func save(orgId: String) async {
        let kroner = Int64(amountText.filter { $0.isNumber }) ?? 0
        guard kroner > 0, !description.trimmingCharacters(in: .whitespaces).isEmpty else { return }
        saving = true; errorText = nil; result = nil
        struct Body: Encodable { let amountMinor: String; let description: String; let accountNumber: String; let paidPrivately: Bool; let businessSharePct: Int? }
        let share = Int(businessSharePct.rounded())
        do {
            let r: PurchaseResult = try await APIClient.shared.post(
                "/api/organizations/\(orgId)/purchases",
                body: Body(amountMinor: String(kroner * 100), description: description, accountNumber: selected,
                           paidPrivately: paidPrivately, businessSharePct: share < 100 ? share : nil))
            result = r
            amountText = ""; description = ""
        } catch {
            errorText = error.localizedDescription
        }
        saving = false
    }
}

struct RegistrerKjopView: View {
    let orgId: String
    @State private var model = KjopViewModel()

    var body: some View {
        Form {
            Section {
                TextField("Beskrivelse (f.eks. «ny laptop»)", text: $model.description)
                HStack {
                    TextField("Beløp", text: $model.amountText).keyboardType(.numberPad)
                    Text("kr").foregroundStyle(.secondary)
                }
                Picker("Kategori", selection: $model.selected) {
                    ForEach(model.categories) { c in
                        Text(c.name).tag(c.accountNumber)
                    }
                }
                Toggle("Betalte du privat?", isOn: $model.paidPrivately)
                VStack(alignment: .leading, spacing: 4) {
                    HStack {
                        Text("Næringsbruk")
                        Spacer()
                        Text("\(Int(model.businessSharePct.rounded())) %")
                            .foregroundStyle(.secondary).monospacedDigit()
                    }
                    Slider(value: $model.businessSharePct, in: 1...100, step: 1)
                        .tint(.reknarenGreen)
                }
            } header: {
                Text("Hva kjøpte du?")
            } footer: {
                Text("Ingen MVA for denne virksomheten. Fradragsberettigede kjøp reduserer skatten din. Betalt privat bokføres mot privatkonto (utlegg). Delvis privat bruk: bare næringsandelen bokføres og gir fradrag.")
            }

            Section {
                Button {
                    Task { await model.save(orgId: orgId) }
                } label: {
                    if model.saving { ProgressView() } else { Label("Registrer kjøp", systemImage: "cart.badge.plus") }
                }
                .disabled(model.saving || model.amountText.filter(\.isNumber).isEmpty || model.description.isEmpty)
            }

            if let msg = model.errorText {
                Section { Text(msg).font(.footnote).foregroundStyle(.red) }
            }
            if let r = model.result {
                KjopResultView(result: r)
            }
        }
        .navigationTitle("Registrer kjøp")
        .task(id: orgId) { await model.loadCategories(orgId: orgId) }
    }
}

private struct KjopResultView: View {
    let result: PurchaseResult
    var body: some View {
        Section {
            VStack(spacing: 12) {
                ReidarView(style: result.deductible ? .success : .idle, size: 88)
                Text("Bokført ✓").font(.headline)
                if result.deductible {
                    Text("Fradragsberettiget — reduserer skatten din med ca \(result.taxReductionMinor.kr).")
                        .font(.subheadline).foregroundStyle(Color.reknarenGreen).multilineTextAlignment(.center)
                } else {
                    Text("Ført på \(result.accountName). Ikke automatisk fullt skattefradrag — kontroller med regnskapsfører ved tvil.")
                        .font(.subheadline).foregroundStyle(.secondary).multilineTextAlignment(.center)
                }
                if result.hasPrivateShare {
                    Text("Næringsdel bokført: \(result.businessAmountMinor.kr). Privat del (\(result.privateAmountMinor.kr)) er holdt utenfor.")
                        .font(.caption).foregroundStyle(.secondary).multilineTextAlignment(.center)
                }
            }
            .frame(maxWidth: .infinity)
            .padding(.vertical, 6)
        }
    }
}
