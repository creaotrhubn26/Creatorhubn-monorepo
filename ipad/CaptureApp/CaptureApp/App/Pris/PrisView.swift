import SwiftUI

/// Native "Pris" tab — the photographer's price administration, rebuilt
/// native instead of the old WebView. Three sections via a segmented
/// picker: Priser (pricing structures), Tillegg (additional costs) and
/// Rabatter (discounts). Each lists rows with a formatted amount/rate,
/// supports swipe-to-delete, and an "+ Legg til" sheet to create new
/// entries. End-to-end synced against `/api/price-administration/*`.

// MARK: - Section

enum PrisSection: String, CaseIterable, Identifiable, Sendable {
    case priser = "Priser"
    case tillegg = "Tillegg"
    case rabatter = "Rabatter"

    var id: String { rawValue }

    var emptyTitle: String {
        switch self {
        case .priser: return "Ingen priser ennå"
        case .tillegg: return "Ingen tillegg ennå"
        case .rabatter: return "Ingen rabatter ennå"
        }
    }

    var emptyIcon: String {
        switch self {
        case .priser: return "tag"
        case .tillegg: return "plus.forwardslash.minus"
        case .rabatter: return "percent"
        }
    }

    var emptyDescription: String {
        switch self {
        case .priser: return "Prisstrukturer du legger til dukker opp her."
        case .tillegg: return "Tilleggskostnader du legger til dukker opp her."
        case .rabatter: return "Rabatter du legger til dukker opp her."
        }
    }

    var addTitle: String {
        switch self {
        case .priser: return "Ny pris"
        case .tillegg: return "Nytt tillegg"
        case .rabatter: return "Ny rabatt"
        }
    }
}

// MARK: - Model

@MainActor
@Observable
final class PrisModel {
    enum Phase: Equatable {
        case loading
        case loaded
        case error(String)
    }

    private(set) var pricing: [PricingStructure] = []
    private(set) var costs: [AdditionalCost] = []
    private(set) var discounts: [Discount] = []
    private(set) var phase: Phase = .loading

    /// Surface-level toast for delete/create failures (the list stays up).
    var actionError: String?

    private func hasAnything() -> Bool {
        !pricing.isEmpty || !costs.isEmpty || !discounts.isEmpty
    }

    func load(force: Bool = false) async {
        if force || !hasAnything() { phase = hasAnything() ? phase : .loading }
        guard let client = DashboardClient.make() else {
            phase = .error(DashboardError.signedOut.localizedDescription)
            return
        }
        do {
            async let p = client.listPricing()
            async let c = client.listAdditionalCosts()
            async let d = client.listDiscounts()
            let (pr, co, di) = try await (p, c, d)
            pricing = pr
            costs = co
            discounts = di
            phase = .loaded
        } catch {
            if !hasAnything() {
                phase = .error((error as? DashboardError)?.localizedDescription
                    ?? error.localizedDescription)
            } else {
                actionError = (error as? DashboardError)?.localizedDescription
                    ?? error.localizedDescription
            }
        }
    }

    // MARK: Pricing

    func createPricing(
        name: String,
        type: String?,
        profession: String?,
        hourlyRate: Double?,
        fullDayRate: Double?,
        basePrice: Double?,
    ) async {
        guard let client = DashboardClient.make() else { return }
        do {
            try await client.createPricing(
                name: name,
                type: type,
                profession: profession,
                hourlyRate: hourlyRate,
                fullDayRate: fullDayRate,
                basePrice: basePrice,
            )
            await load(force: true)
        } catch {
            actionError = (error as? DashboardError)?.localizedDescription
                ?? error.localizedDescription
        }
    }

    func deletePricing(at offsets: IndexSet) async {
        let ids = offsets.map { pricing[$0].id }
        pricing.remove(atOffsets: offsets)
        guard let client = DashboardClient.make() else { return }
        for id in ids {
            do { try await client.deletePricing(id: id) }
            catch {
                actionError = (error as? DashboardError)?.localizedDescription
                    ?? error.localizedDescription
                await load(force: true)
            }
        }
    }

    // MARK: Additional costs

    func createCost(
        name: String,
        description: String?,
        type: String?,
        amount: Double?,
        isBillable: Bool,
    ) async {
        guard let client = DashboardClient.make() else { return }
        do {
            try await client.createAdditionalCost(
                name: name,
                description: description,
                type: type,
                amount: amount,
                isBillable: isBillable,
            )
            await load(force: true)
        } catch {
            actionError = (error as? DashboardError)?.localizedDescription
                ?? error.localizedDescription
        }
    }

    func deleteCost(at offsets: IndexSet) async {
        let ids = offsets.map { costs[$0].id }
        costs.remove(atOffsets: offsets)
        guard let client = DashboardClient.make() else { return }
        for id in ids {
            do { try await client.deleteAdditionalCost(id: id) }
            catch {
                actionError = (error as? DashboardError)?.localizedDescription
                    ?? error.localizedDescription
                await load(force: true)
            }
        }
    }

    // MARK: Discounts

    func createDiscount(
        name: String,
        discountCode: String?,
        discountValue: Double?,
        isPercentage: Bool,
    ) async {
        guard let client = DashboardClient.make() else { return }
        do {
            try await client.createDiscount(
                name: name,
                discountCode: discountCode,
                discountValue: discountValue,
                isPercentage: isPercentage,
            )
            await load(force: true)
        } catch {
            actionError = (error as? DashboardError)?.localizedDescription
                ?? error.localizedDescription
        }
    }

    func deleteDiscount(at offsets: IndexSet) async {
        let ids = offsets.map { discounts[$0].id }
        discounts.remove(atOffsets: offsets)
        guard let client = DashboardClient.make() else { return }
        for id in ids {
            do { try await client.deleteDiscount(id: id) }
            catch {
                actionError = (error as? DashboardError)?.localizedDescription
                    ?? error.localizedDescription
                await load(force: true)
            }
        }
    }
}

// MARK: - View

struct PrisView: View {
    @State private var model = PrisModel()
    @State private var section: PrisSection = .priser
    @State private var showingAdd = false

    private var isEmptyForSection: Bool {
        switch section {
        case .priser: return model.pricing.isEmpty
        case .tillegg: return model.costs.isEmpty
        case .rabatter: return model.discounts.isEmpty
        }
    }

    var body: some View {
        NavigationStack {
            VStack(spacing: 0) {
                Picker("Seksjon", selection: $section) {
                    ForEach(PrisSection.allCases) { s in
                        Text(s.rawValue).tag(s)
                    }
                }
                .pickerStyle(.segmented)
                .padding(.horizontal)
                .padding(.vertical, 12)

                content
            }
            .frame(maxWidth: .infinity, maxHeight: .infinity)
            .background(CHTheme.bg.ignoresSafeArea())
            .navigationTitle("Pris")
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button {
                        showingAdd = true
                    } label: {
                        Label("Legg til", systemImage: "plus")
                    }
                }
                ToolbarItem(placement: .topBarTrailing) {
                    Button {
                        Task { await model.load(force: true) }
                    } label: {
                        Image(systemName: "arrow.clockwise")
                    }
                }
            }
            .sheet(isPresented: $showingAdd) {
                AddPrisSheet(section: section, model: model)
            }
            .alert(
                "Noe gikk galt",
                isPresented: Binding(
                    get: { model.actionError != nil },
                    set: { if !$0 { model.actionError = nil } },
                ),
            ) {
                Button("OK", role: .cancel) { model.actionError = nil }
            } message: {
                Text(model.actionError ?? "")
            }
        }
        .task { await model.load() }
    }

    @ViewBuilder
    private var content: some View {
        switch model.phase {
        case .loading where !hasAnything:
            ProgressView("Laster priser…")
                .frame(maxWidth: .infinity, maxHeight: .infinity)
        case let .error(message) where !hasAnything:
            ContentUnavailableView {
                Label("Kunne ikke laste priser", systemImage: "exclamationmark.icloud")
            } description: {
                Text(message)
            } actions: {
                Button("Prøv igjen") { Task { await model.load(force: true) } }
                    .buttonStyle(.borderedProminent)
            }
            .frame(maxWidth: .infinity, maxHeight: .infinity)
        default:
            if isEmptyForSection {
                ContentUnavailableView {
                    Label(section.emptyTitle, systemImage: section.emptyIcon)
                } description: {
                    Text(section.emptyDescription)
                } actions: {
                    Button("Legg til") { showingAdd = true }
                        .buttonStyle(.borderedProminent)
                }
                .frame(maxWidth: .infinity, maxHeight: .infinity)
            } else {
                list
            }
        }
    }

    private var hasAnything: Bool {
        !model.pricing.isEmpty || !model.costs.isEmpty || !model.discounts.isEmpty
    }

    private var list: some View {
        List {
            switch section {
            case .priser:
                ForEach(model.pricing) { item in
                    PricingRow(item: item)
                        .listRowBackground(CHTheme.surface)
                        .listRowSeparatorTint(CHTheme.border)
                }
                .onDelete { offsets in Task { await model.deletePricing(at: offsets) } }
            case .tillegg:
                ForEach(model.costs) { item in
                    CostRow(item: item)
                        .listRowBackground(CHTheme.surface)
                        .listRowSeparatorTint(CHTheme.border)
                }
                .onDelete { offsets in Task { await model.deleteCost(at: offsets) } }
            case .rabatter:
                ForEach(model.discounts) { item in
                    DiscountRow(item: item)
                        .listRowBackground(CHTheme.surface)
                        .listRowSeparatorTint(CHTheme.border)
                }
                .onDelete { offsets in Task { await model.deleteDiscount(at: offsets) } }
            }
        }
        .listStyle(.insetGrouped)
        .scrollContentBackground(.hidden)
        .refreshable { await model.load(force: true) }
    }
}

// MARK: - Rows

private struct PricingRow: View {
    let item: PricingStructure

    private var primaryAmount: String {
        if let hourly = item.hourlyRate {
            return "\(PrisFormat.kr(hourly))/time"
        }
        if let fullDay = item.fullDayRate {
            return "\(PrisFormat.kr(fullDay))/dag"
        }
        if let base = item.basePrice {
            return PrisFormat.kr(base)
        }
        return "—"
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            HStack(alignment: .firstTextBaseline) {
                Text(item.name ?? "Uten navn")
                    .font(.headline)
                    .foregroundStyle(CHTheme.textPrimary)
                Spacer()
                Text(primaryAmount)
                    .font(.subheadline.weight(.semibold).monospacedDigit())
                    .foregroundStyle(CHTheme.accent)
            }

            HStack(spacing: 8) {
                if let profession = item.profession, !profession.isEmpty {
                    PrisTag(text: profession)
                }
                if let type = item.type, !type.isEmpty {
                    PrisTag(text: type, tint: CHTheme.textSecondary)
                }
            }

            HStack(spacing: 14) {
                if let base = item.basePrice {
                    SubAmount(label: "Grunnpris", value: PrisFormat.kr(base))
                }
                if let min = item.minimumPrice {
                    SubAmount(label: "Min", value: PrisFormat.kr(min))
                }
                if let max = item.maximumPrice {
                    SubAmount(label: "Maks", value: PrisFormat.kr(max))
                }
            }
        }
        .padding(.vertical, 4)
    }
}

private struct CostRow: View {
    let item: AdditionalCost

    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            HStack(alignment: .firstTextBaseline) {
                Text(item.name ?? "Uten navn")
                    .font(.headline)
                    .foregroundStyle(CHTheme.textPrimary)
                Spacer()
                Text(PrisFormat.kr(item.amount))
                    .font(.subheadline.weight(.semibold).monospacedDigit())
                    .foregroundStyle(CHTheme.accent)
            }

            if let description = item.description, !description.isEmpty {
                Text(description)
                    .font(.subheadline)
                    .foregroundStyle(CHTheme.textSecondary)
            }

            HStack(spacing: 8) {
                if let type = item.type, !type.isEmpty {
                    PrisTag(text: type, tint: CHTheme.textSecondary)
                }
                if let billable = item.isBillable {
                    PrisTag(
                        text: billable ? "Fakturerbar" : "Ikke fakturerbar",
                        tint: billable ? CHTheme.success : CHTheme.textMuted,
                    )
                }
            }
        }
        .padding(.vertical, 4)
    }
}

private struct DiscountRow: View {
    let item: Discount

    private var valueText: String {
        guard let value = item.discountValue else { return "—" }
        if item.isPercentage == true {
            return "\(PrisFormat.number(value))%"
        }
        return PrisFormat.kr(value)
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            HStack(alignment: .firstTextBaseline) {
                Text(item.name ?? "Uten navn")
                    .font(.headline)
                    .foregroundStyle(CHTheme.textPrimary)
                Spacer()
                Text(valueText)
                    .font(.subheadline.weight(.semibold).monospacedDigit())
                    .foregroundStyle(CHTheme.accent)
            }

            if let description = item.description, !description.isEmpty {
                Text(description)
                    .font(.subheadline)
                    .foregroundStyle(CHTheme.textSecondary)
            }

            if let code = item.discountCode, !code.isEmpty {
                PrisTag(text: code, tint: CHTheme.info)
            }
        }
        .padding(.vertical, 4)
    }
}

// MARK: - Small components

private struct PrisTag: View {
    let text: String
    var tint: Color = CHTheme.accent

    var body: some View {
        Text(text)
            .font(.caption2.weight(.semibold))
            .padding(.horizontal, 8)
            .padding(.vertical, 3)
            .background(tint.opacity(0.15), in: Capsule())
            .foregroundStyle(tint)
    }
}

private struct SubAmount: View {
    let label: String
    let value: String

    var body: some View {
        VStack(alignment: .leading, spacing: 1) {
            Text(label)
                .font(.caption2)
                .foregroundStyle(CHTheme.textMuted)
            Text(value)
                .font(.caption.monospacedDigit())
                .foregroundStyle(CHTheme.textSecondary)
        }
    }
}

// MARK: - Add sheet

private struct AddPrisSheet: View {
    let section: PrisSection
    let model: PrisModel
    @Environment(\.dismiss) private var dismiss

    // Shared
    @State private var name = ""

    // Pricing
    @State private var pricingType = ""
    @State private var profession = ""
    @State private var hourlyRate = ""
    @State private var fullDayRate = ""
    @State private var basePrice = ""

    // Cost
    @State private var costDescription = ""
    @State private var costType = ""
    @State private var costAmount = ""
    @State private var isBillable = true

    // Discount
    @State private var discountCode = ""
    @State private var discountValue = ""
    @State private var isPercentage = true

    @State private var saving = false

    private var canSave: Bool {
        !name.trimmingCharacters(in: .whitespaces).isEmpty && !saving
    }

    var body: some View {
        NavigationStack {
            Form {
                switch section {
                case .priser: pricingFields
                case .tillegg: costFields
                case .rabatter: discountFields
                }
            }
            .scrollContentBackground(.hidden)
            .background(CHTheme.bg.ignoresSafeArea())
            .navigationTitle(section.addTitle)
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Avbryt") { dismiss() }
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Lagre") { Task { await save() } }
                        .disabled(!canSave)
                }
            }
        }
        .presentationDetents([.medium, .large])
    }

    // MARK: Fields

    private var pricingFields: some View {
        Group {
            Section("Navn") {
                TextField("F.eks. Bryllupsfotografering", text: $name)
            }
            Section("Detaljer") {
                TextField("Type (f.eks. timepris, dagspris)", text: $pricingType)
                TextField("Yrke / rolle", text: $profession)
            }
            Section("Priser (kr)") {
                numberField("Timepris", text: $hourlyRate)
                numberField("Dagspris", text: $fullDayRate)
                numberField("Grunnpris", text: $basePrice)
            }
        }
    }

    private var costFields: some View {
        Group {
            Section("Navn") {
                TextField("F.eks. Reise", text: $name)
            }
            Section("Detaljer") {
                TextField("Beskrivelse", text: $costDescription)
                TextField("Type", text: $costType)
                numberField("Beløp (kr)", text: $costAmount)
                Toggle("Fakturerbar", isOn: $isBillable)
            }
        }
    }

    private var discountFields: some View {
        Group {
            Section("Navn") {
                TextField("F.eks. Lojalitetsrabatt", text: $name)
            }
            Section("Detaljer") {
                TextField("Rabattkode", text: $discountCode)
                    .textInputAutocapitalization(.characters)
                numberField(isPercentage ? "Verdi (%)" : "Verdi (kr)", text: $discountValue)
                Toggle("Prosent", isOn: $isPercentage)
            }
        }
    }

    private func numberField(_ title: String, text: Binding<String>) -> some View {
        TextField(title, text: text)
            .keyboardType(.decimalPad)
    }

    // MARK: Save

    private func parse(_ text: String) -> Double? {
        let trimmed = text.trimmingCharacters(in: .whitespaces)
        if trimmed.isEmpty { return nil }
        let normalized = trimmed
            .replacingOccurrences(of: " ", with: "")
            .replacingOccurrences(of: ",", with: ".")
        return Double(normalized)
    }

    private func nilIfEmpty(_ text: String) -> String? {
        let trimmed = text.trimmingCharacters(in: .whitespaces)
        return trimmed.isEmpty ? nil : trimmed
    }

    private func save() async {
        let trimmedName = name.trimmingCharacters(in: .whitespaces)
        guard !trimmedName.isEmpty else { return }
        saving = true
        switch section {
        case .priser:
            await model.createPricing(
                name: trimmedName,
                type: nilIfEmpty(pricingType),
                profession: nilIfEmpty(profession),
                hourlyRate: parse(hourlyRate),
                fullDayRate: parse(fullDayRate),
                basePrice: parse(basePrice),
            )
        case .tillegg:
            await model.createCost(
                name: trimmedName,
                description: nilIfEmpty(costDescription),
                type: nilIfEmpty(costType),
                amount: parse(costAmount),
                isBillable: isBillable,
            )
        case .rabatter:
            await model.createDiscount(
                name: trimmedName,
                discountCode: nilIfEmpty(discountCode),
                discountValue: parse(discountValue),
                isPercentage: isPercentage,
            )
        }
        saving = false
        if model.actionError == nil {
            dismiss()
        }
    }
}
