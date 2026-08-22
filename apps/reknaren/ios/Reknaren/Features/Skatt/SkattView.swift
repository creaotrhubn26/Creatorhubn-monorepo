import SwiftUI

struct TaxReserveItem: Decodable, Identifiable, Sendable {
    let id: String
    let amountMinor: Money
    let reservedAt: String
    let note: String?
}

struct TaxPlacement: Decodable, Identifiable, Sendable {
    let id: String
    let name: String
    let placementType: String
    let liquidity: String
    let ringFenced: Bool
    let ticker: String?
    let costMinor: Money
    let marketValueMinor: Money
    let unrealisedGainMinor: Money
    let gainTaxMinor: Money
    let valuedAt: String?

    /// Aksjer/aksjefond følger aksjonærmodellen (oppjustering → 37,84 %).
    var isEquity: Bool { placementType == "equity_fund" || placementType == "stock" }

    var typeLabel: String {
        switch placementType {
        case "bank": return "Bankkonto"
        case "money_market_fund": return "Pengemarkedsfond"
        case "bond_fund": return "Obligasjonsfond"
        case "equity_fund": return "Aksjefond"
        case "stock": return "Aksjer"
        default: return placementType
        }
    }
    var gain: Bool { unrealisedGainMinor.minor > 0 }
    var loss: Bool { unrealisedGainMinor.minor < 0 }
}

struct TaxTermin: Decodable, Identifiable, Sendable {
    let date: String
    let amountMinor: Money
    let daysUntil: Int
    let coveredLiquid: Bool
    var id: String { date }
}

struct LiquidityLadder: Decodable, Sendable {
    let liquidityFloorMinor: Money
    let freeToPlaceMinor: Money
    let nextDueDate: String?
    let terminer: [TaxTermin]
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
    let placedMarketValueMinor: Money
    let unrealisedGainMinor: Money
    let gainTaxEstimateMinor: Money
    let realisedGainMinor: Money
    let realisedGainTaxMinor: Money
    let coverageMinor: Money
    let placements: [TaxPlacement]
    let ladder: LiquidityLadder

    var ratePct: String { String(format: "%.1f", Double(effectiveRatePer1000) / 10.0) }
    var marginalPct: String { String(format: "%.1f", Double(marginalRatePer1000) / 10.0) }
    /// Inntektsåret fra asOf (YYYY-…) — brukes i forklaringstekst.
    var year: String { String(asOf.prefix(4)) }
    var hasPaidAdvance: Bool { paidAdvanceTaxMinor.minor > 0 }
    var covered: Bool { recommendedReserveMinor.minor > 0 && remainingMinor.minor <= 0 }
    var progress: Double {
        guard recommendedReserveMinor.minor > 0 else { return 0 }
        // Dekning (markedsverdi av avsetning) + betalt forskuddsskatt teller mot målet.
        let dekket = coverageMinor.minor + paidAdvanceTaxMinor.minor
        return min(1, Double(dekket) / Double(recommendedReserveMinor.minor))
    }
}

@MainActor
@Observable
final class SkattViewModel {
    enum Load { case idle, loading, loaded(TaxReserveOverview), failed(String) }
    var load: Load = .idle
    var amountText: String = ""
    /// nil = kontant; ellers plassering-id avsetningen legges i.
    var selectedPlacementId: String?
    var saving = false
    var justCovered = false
    var showAddPlacement = false
    var showAdvanceTax = false
    var tradePlacement: TaxPlacement?
    /// Siste realiserte gevinst fra et salg — vises kort som kvittering.
    var lastRealisedGainMinor: Int64?

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
        struct Body: Encodable { let amountMinor: String; let placementId: String? }
        let wasCovered = (currentOverview?.covered) ?? false
        do {
            let _: EmptyID = try await APIClient.shared.post(
                "/api/organizations/\(orgId)/tax/reserves",
                body: Body(amountMinor: String(kroner * 100), placementId: selectedPlacementId))
            amountText = ""
            await fetch(orgId: orgId)
            if let ov = currentOverview, ov.covered, !wasCovered { justCovered = true }
        } catch {
            load = .failed(error.localizedDescription)
        }
        saving = false
    }

    func createPlacement(orgId: String, name: String, type: String, liquidity: String, ticker: String) async {
        struct Body: Encodable { let name: String; let placementType: String; let liquidity: String; let ticker: String? }
        let t = ticker.trimmingCharacters(in: .whitespaces)
        do {
            let _: EmptyID = try await APIClient.shared.post(
                "/api/organizations/\(orgId)/tax/placements",
                body: Body(name: name, placementType: type, liquidity: liquidity, ticker: t.isEmpty ? nil : t))
            showAddPlacement = false
            await fetch(orgId: orgId)
        } catch { load = .failed(error.localizedDescription) }
    }

    func refreshQuote(orgId: String, placementId: String) async {
        struct Empty: Encodable {}
        struct Result: Decodable { let marketValueMinor: Money }
        do {
            let _: Result = try await APIClient.shared.post(
                "/api/organizations/\(orgId)/tax/placements/\(placementId)/refresh-quote", body: Empty())
            await fetch(orgId: orgId)
        } catch { load = .failed(error.localizedDescription) }
    }

    func setAdvanceTax(orgId: String, year: Int, terminer: [(termNo: Int, dueDate: String, amountKr: Int64)]) async {
        struct Item: Encodable { let termNo: Int; let dueDate: String; let amountMinor: String }
        struct Body: Encodable { let year: Int; let installments: [Item] }
        let items = terminer.filter { $0.amountKr > 0 }.map { Item(termNo: $0.termNo, dueDate: $0.dueDate, amountMinor: String($0.amountKr * 100)) }
        guard !items.isEmpty else { return }
        do {
            let _: OKFlag = try await APIClient.shared.put(
                "/api/organizations/\(orgId)/tax/advance-installments", body: Body(year: year, installments: items))
            showAdvanceTax = false
            await fetch(orgId: orgId)
        } catch { load = .failed(error.localizedDescription) }
    }

    func addLot(orgId: String, placementId: String, units: String, costKr: Int64) async {
        struct Body: Encodable { let units: String; let costMinor: String }
        guard costKr > 0, !units.isEmpty else { return }
        do {
            let _: EmptyID = try await APIClient.shared.post(
                "/api/organizations/\(orgId)/tax/placements/\(placementId)/lots",
                body: Body(units: units, costMinor: String(costKr * 100)))
            tradePlacement = nil
            await fetch(orgId: orgId)
        } catch { load = .failed(error.localizedDescription) }
    }

    func recordDisposal(orgId: String, placementId: String, units: String, proceedsKr: Int64) async {
        struct Body: Encodable { let units: String; let proceedsMinor: String }
        struct Result: Decodable { let realisedGainMinor: Money }
        guard proceedsKr > 0, !units.isEmpty else { return }
        do {
            let r: Result = try await APIClient.shared.post(
                "/api/organizations/\(orgId)/tax/placements/\(placementId)/disposals",
                body: Body(units: units, proceedsMinor: String(proceedsKr * 100)))
            lastRealisedGainMinor = r.realisedGainMinor.minor // behold arket åpent så gevinsten vises
            await fetch(orgId: orgId)
        } catch { load = .failed(error.localizedDescription) }
    }

    func recordValuation(orgId: String, placementId: String, valueKr: Int64) async {
        struct Body: Encodable { let marketValueMinor: String }
        do {
            let _: OKFlag = try await APIClient.shared.post(
                "/api/organizations/\(orgId)/tax/placements/\(placementId)/valuations",
                body: Body(marketValueMinor: String(valueKr * 100)))
            await fetch(orgId: orgId)
        } catch { load = .failed(error.localizedDescription) }
    }

    private var currentOverview: TaxReserveOverview? {
        if case .loaded(let ov) = load { return ov }
        return nil
    }
}

private struct OKFlag: Decodable, Sendable { let ok: Bool? }

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
                    RegisterSection(model: model, orgId: orgId, placements: ov.placements)
                    LikviditetSection(model: model, ov: ov)
                    PlaceringSection(model: model, orgId: orgId, ov: ov)
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
        .sheet(isPresented: $model.showAddPlacement) { AddPlacementSheet(model: model, orgId: orgId) }
        .sheet(isPresented: $model.showAdvanceTax) { AdvanceTaxSheet(model: model, orgId: orgId) }
        .sheet(item: $model.tradePlacement) { p in TradeSheet(model: model, orgId: orgId, placement: p) }
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
    let placements: [TaxPlacement]
    var body: some View {
        Section("Registrer at du har satt av") {
            HStack {
                TextField("Beløp i kr", text: $model.amountText)
                    .keyboardType(.numberPad)
                Text("kr").foregroundStyle(.secondary)
            }
            if !placements.isEmpty {
                Picker("Plassering", selection: $model.selectedPlacementId) {
                    Text("Kontant / skattekonto").tag(String?.none)
                    ForEach(placements) { p in
                        Text(p.name).tag(String?.some(p.id))
                    }
                }
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

/// Likviditetstrapp: hva som må stå likvid vs kan plasseres lenger. Kun horisont-anbefaling.
private struct LikviditetSection: View {
    @Bindable var model: SkattViewModel
    let ov: TaxReserveOverview
    var body: some View {
        Section {
            HStack {
                VStack(alignment: .leading, spacing: 2) {
                    Text("Må stå likvid").font(.caption).foregroundStyle(.secondary)
                    Text(ov.ladder.liquidityFloorMinor.kr).font(.body.weight(.semibold)).monospacedDigit()
                    if let d = ov.ladder.nextDueDate {
                        Text("før \(d)").font(.caption2).foregroundStyle(.secondary)
                    }
                }
                Spacer()
                VStack(alignment: .trailing, spacing: 2) {
                    Text("Fri horisont").font(.caption).foregroundStyle(.secondary)
                    Text(ov.ladder.freeToPlaceMinor.kr).font(.body.weight(.semibold)).monospacedDigit()
                        .foregroundStyle(Color.reknarenGreen)
                }
            }
            ForEach(ov.ladder.terminer) { t in
                HStack {
                    Image(systemName: t.coveredLiquid ? "checkmark.circle.fill" : "circle")
                        .foregroundStyle(t.coveredLiquid ? .green : .secondary)
                    Text("Forskuddsskatt \(t.date)").font(.caption)
                    Spacer()
                    Text(t.amountMinor.kr).font(.caption).monospacedDigit().foregroundStyle(.secondary)
                }
            }
            Button { model.showAdvanceTax = true } label: {
                Label("Registrer fastsatt forskuddsskatt", systemImage: "calendar.badge.clock")
            }.font(.caption)
        } header: {
            Text("Likviditet mot forfall")
        } footer: {
            Text("«Fri horisont» er den delen som ikke trengs likvid i det nærmeste vinduet — den kan plasseres lenger hvis du vil ta risiko. Ikke investeringsråd. I ENK er pengene ikke øremerket; faller en plassering, skylder du fortsatt hele skatten.")
        }
    }
}

/// Plasseringer: markedsverdi + urealisert gevinst + oppdater verdi.
private struct PlaceringSection: View {
    @Bindable var model: SkattViewModel
    let orgId: String
    let ov: TaxReserveOverview
    @State private var valueText: [String: String] = [:]
    var body: some View {
        Section {
            ForEach(ov.placements) { p in
                VStack(alignment: .leading, spacing: 6) {
                    HStack {
                        VStack(alignment: .leading, spacing: 2) {
                            Text(p.name).font(.body.weight(.medium))
                            Text(p.typeLabel).font(.caption).foregroundStyle(.secondary)
                        }
                        Spacer()
                        VStack(alignment: .trailing, spacing: 2) {
                            Text(p.marketValueMinor.kr).font(.body.weight(.semibold)).monospacedDigit()
                            if p.gain {
                                Text("+\(p.unrealisedGainMinor.kr)").font(.caption).foregroundStyle(.green).monospacedDigit()
                            } else if p.loss {
                                Text(p.unrealisedGainMinor.kr).font(.caption).foregroundStyle(.red).monospacedDigit()
                            }
                        }
                    }
                    if p.gainTaxMinor.minor > 0 {
                        Text("Skatt på gevinst ca \(p.gainTaxMinor.kr)\(p.isEquity ? " (aksjonærmodell 37,84 %)" : " (22 %)")")
                            .font(.caption2).foregroundStyle(.secondary).monospacedDigit()
                    }
                    HStack {
                        TextField("Ny verdi i kr", text: Binding(
                            get: { valueText[p.id] ?? "" },
                            set: { valueText[p.id] = $0 }))
                            .keyboardType(.numberPad).font(.caption)
                        Button("Oppdater") {
                            let kr = Int64((valueText[p.id] ?? "").filter { $0.isNumber }) ?? 0
                            guard kr > 0 else { return }
                            valueText[p.id] = ""
                            Task { await model.recordValuation(orgId: orgId, placementId: p.id, valueKr: kr) }
                        }
                        .font(.caption).buttonStyle(.bordered)
                    }
                    if let tick = p.ticker, !tick.isEmpty {
                        Button {
                            Task { await model.refreshQuote(orgId: orgId, placementId: p.id) }
                        } label: {
                            Label("Hent kurs (\(tick))", systemImage: "arrow.clockwise")
                        }.font(.caption)
                    }
                    if p.placementType != "bank" {
                        Button {
                            model.lastRealisedGainMinor = nil
                            model.tradePlacement = p
                        } label: {
                            Label("Registrer kjøp / salg av andeler", systemImage: "arrow.left.arrow.right")
                        }.font(.caption)
                    }
                }
                .padding(.vertical, 2)
            }
            Button { model.showAddPlacement = true } label: {
                Label("Legg til plassering", systemImage: "chart.line.uptrend.xyaxis")
            }
        } header: {
            Text("Plassering av avsetning")
        } footer: {
            VStack(alignment: .leading, spacing: 4) {
                if ov.unrealisedGainMinor.minor > 0 {
                    Text("Urealisert gevinst \(ov.unrealisedGainMinor.kr). Anslått skatt: \(ov.gainTaxEstimateMinor.kr) (aksjer etter oppjustering 1,72 og skjermingsfradrag; renter/bank flat 22 %).")
                }
                if ov.realisedGainMinor.minor != 0 {
                    Text("Realisert i år: \(ov.realisedGainMinor.kr). Skatt på realisert gevinst (kommer i tillegg): \(ov.realisedGainTaxMinor.kr). Aksjer beregnes FIFO, fond etter gjennomsnitt.")
                }
            }
        }
    }
}

private struct AddPlacementSheet: View {
    @Bindable var model: SkattViewModel
    let orgId: String
    @Environment(\.dismiss) private var dismiss
    @State private var name = ""
    @State private var type = "money_market_fund"
    @State private var liquidity = "days"
    @State private var ticker = ""
    private var showsTicker: Bool { type == "stock" || type == "equity_fund" }
    private let types: [(String, String)] = [
        ("bank", "Bankkonto"), ("money_market_fund", "Pengemarkedsfond"),
        ("bond_fund", "Obligasjonsfond"), ("equity_fund", "Aksjefond"), ("stock", "Aksjer"),
    ]
    private let liquidities: [(String, String)] = [
        ("instant", "Straks"), ("days", "Noen dager"), ("short_term", "Kort sikt"), ("long_term", "Lang sikt"),
    ]
    var body: some View {
        NavigationStack {
            Form {
                Section {
                    TextField("Navn (f.eks. «KLP Pengemarked»)", text: $name)
                    Picker("Type", selection: $type) { ForEach(types, id: \.0) { Text($0.1).tag($0.0) } }
                    Picker("Likviditet", selection: $liquidity) { ForEach(liquidities, id: \.0) { Text($0.1).tag($0.0) } }
                    if showsTicker {
                        TextField("Ticker for auto-kurs (f.eks. EQNR.OL)", text: $ticker)
                            .textInputAutocapitalization(.characters).autocorrectionDisabled()
                    }
                } header: {
                    Text("Ny plassering")
                } footer: {
                    if showsTicker {
                        Text("Legg inn Oslo Børs-ticker (f.eks. EQNR.OL) for å hente kurs automatisk. La stå tomt for manuell verdi — fond uten børsticker oppdateres manuelt.")
                    }
                }
            }
            .navigationTitle("Legg til plassering")
            .toolbar {
                ToolbarItem(placement: .cancellationAction) { Button("Avbryt") { dismiss() } }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Lagre") {
                        Task { await model.createPlacement(orgId: orgId, name: name, type: type, liquidity: liquidity, ticker: showsTicker ? ticker : "") }
                    }.disabled(name.trimmingCharacters(in: .whitespaces).isEmpty)
                }
            }
        }
    }
}

/// Registrer kjøp (andeler + kostpris) eller salg (andeler + vederlag) av en plassering.
private struct TradeSheet: View {
    @Bindable var model: SkattViewModel
    let orgId: String
    let placement: TaxPlacement
    @Environment(\.dismiss) private var dismiss
    @State private var isSell = false
    @State private var units = ""
    @State private var amount = ""
    private var methodNote: String {
        placement.placementType == "stock" ? "Aksjer: gevinst beregnes FIFO." : "Fond: gevinst beregnes etter gjennomsnittsmetoden."
    }
    var body: some View {
        NavigationStack {
            Form {
                Picker("Handel", selection: $isSell) {
                    Text("Kjøp").tag(false)
                    Text("Salg").tag(true)
                }.pickerStyle(.segmented)
                Section {
                    HStack { Text("Andeler"); Spacer(); TextField("antall", text: $units).keyboardType(.decimalPad).multilineTextAlignment(.trailing).frame(width: 120) }
                    HStack { Text(isSell ? "Vederlag" : "Kostpris"); Spacer(); TextField("kr", text: $amount).keyboardType(.numberPad).multilineTextAlignment(.trailing).frame(width: 120); Text("kr").foregroundStyle(.secondary) }
                } footer: {
                    Text(methodNote + (isSell ? " Realisert gevinst = vederlag − kostbasis." : ""))
                }
                if let g = model.lastRealisedGainMinor {
                    Section {
                        Label("Realisert gevinst: \(Money(minor: g).kr)", systemImage: g >= 0 ? "arrow.up.right" : "arrow.down.right")
                            .foregroundStyle(g >= 0 ? .green : .red)
                    }
                }
            }
            .navigationTitle(placement.name)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) { Button("Lukk") { dismiss() } }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Lagre") {
                        let kr = Int64(amount.filter { $0.isNumber }) ?? 0
                        let u = units.trimmingCharacters(in: .whitespaces)
                        Task {
                            if isSell { await model.recordDisposal(orgId: orgId, placementId: placement.id, units: u, proceedsKr: kr) }
                            else { await model.addLot(orgId: orgId, placementId: placement.id, units: u, costKr: kr) }
                        }
                    }.disabled(units.isEmpty || amount.filter(\.isNumber).isEmpty)
                }
            }
        }
    }
}

/// Registrer fastsatt forskuddsskatt per termin (fra Skatteetatens forskuddsutskriving).
private struct AdvanceTaxSheet: View {
    @Bindable var model: SkattViewModel
    let orgId: String
    @Environment(\.dismiss) private var dismiss
    @State private var year = Calendar.current.component(.year, from: Date())
    @State private var amounts: [String] = ["", "", "", ""]
    private let dates = ["03-15", "06-15", "09-15", "12-15"]
    private let labels = ["1. termin (15. mars)", "2. termin (15. juni)", "3. termin (15. sept)", "4. termin (15. des)"]
    var body: some View {
        NavigationStack {
            Form {
                Section {
                    Stepper("År: \(year)", value: $year, in: 2020...2100)
                    ForEach(0..<4, id: \.self) { i in
                        HStack {
                            Text(labels[i]).font(.callout)
                            Spacer()
                            TextField("kr", text: $amounts[i]).keyboardType(.numberPad)
                                .multilineTextAlignment(.trailing).frame(width: 100)
                        }
                    }
                } footer: {
                    Text("Fra forskuddsutskrivingen din på Skatteetaten. Presiserer likviditetstrappen — hva som må stå likvid før hvert forfall. La stå tomt for terminer du ikke vil registrere.")
                }
            }
            .navigationTitle("Fastsatt forskuddsskatt")
            .toolbar {
                ToolbarItem(placement: .cancellationAction) { Button("Avbryt") { dismiss() } }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Lagre") {
                        let terminer = (0..<4).map { i in
                            (termNo: i + 1, dueDate: "\(year)-\(dates[i])", amountKr: Int64(amounts[i].filter { $0.isNumber }) ?? 0)
                        }
                        Task { await model.setAdvanceTax(orgId: orgId, year: year, terminer: terminer) }
                    }
                }
            }
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
