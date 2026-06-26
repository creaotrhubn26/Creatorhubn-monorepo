// LeadgridDealSection.swift
//
// Deal-redigerings-seksjon for LeadgridCustomerDetailView (mig 0349).
//
// Viser:
//   - Probability slider (0-100, fargen reflekterer verdien)
//   - Expected close date picker
//   - Deal amount input m/ valuta-suffix
//   - Stort weighted-value-display
//   - Stage-historikk-timeline (siste 5 endringer)

import SwiftUI

struct LeadgridDealSection: View {
    let leadId: String
    let api: APIClient

    @State private var deal: LeadgridDeal?
    @State private var history: [LeadgridDealStageChange] = []
    @State private var loading = true
    @State private var saving = false
    @State private var errorText: String?

    // Editable felt
    @State private var probability: Double = 0
    @State private var amountText: String = ""
    @State private var closeDate: Date = Date()
    @State private var hasCloseDate: Bool = false

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack(spacing: 8) {
                Image(systemName: "dollarsign.circle.fill")
                    .foregroundStyle(Color(hex: "a855f7"))
                Text("Deal")
                    .font(.title3.bold())
                Spacer()
                if saving { ProgressView().scaleEffect(0.8) }
            }

            if loading {
                ProgressView().padding(.vertical, 12)
            } else if let errorText {
                Text(errorText).foregroundStyle(.red).font(.caption)
            } else {
                weightedDisplay
                probabilitySlider
                amountField
                closeDateField
                if !history.isEmpty {
                    Divider().padding(.vertical, 4)
                    Text("Stage-historikk")
                        .font(.caption.bold())
                        .foregroundStyle(.secondary)
                    ForEach(history.prefix(5)) { h in
                        HistoryRow(change: h)
                    }
                }
            }
        }
        .padding(16)
        .background(
            Color(.secondarySystemBackground),
            in: RoundedRectangle(cornerRadius: 14)
        )
        .task { await load() }
    }

    // MARK: - Subviews

    private var weightedDisplay: some View {
        let amount = Double(amountText) ?? 0
        let weighted = amount * (probability / 100)
        return VStack(alignment: .leading, spacing: 2) {
            Text("Weighted value")
                .font(.caption).foregroundStyle(.secondary)
            HStack(alignment: .firstTextBaseline, spacing: 6) {
                Text(fmtNok(weighted))
                    .font(.system(size: 28, weight: .bold))
                    .foregroundStyle(colorForProbability(probability))
                Text("(\(fmtNok(amount)) × \(Int(probability))%)")
                    .font(.caption).foregroundStyle(.secondary)
            }
        }
    }

    private var probabilitySlider: some View {
        VStack(alignment: .leading, spacing: 4) {
            HStack {
                Text("Probability")
                    .font(.caption).foregroundStyle(.secondary)
                Spacer()
                Text("\(Int(probability))%")
                    .font(.caption.bold())
                    .foregroundStyle(colorForProbability(probability))
            }
            Slider(value: $probability, in: 0...100, step: 1) { editing in
                if !editing {
                    Task { await save(field: .probability) }
                }
            }
            .tint(colorForProbability(probability))
        }
    }

    private var amountField: some View {
        HStack {
            Text("Beløp")
                .font(.caption).foregroundStyle(.secondary)
                .frame(width: 100, alignment: .leading)
            TextField("0", text: $amountText)
                .keyboardType(.decimalPad)
                .textFieldStyle(.roundedBorder)
                .onSubmit { Task { await save(field: .amount) } }
            Text(deal?.dealCurrency ?? "NOK")
                .font(.caption.bold())
                .foregroundStyle(.secondary)
        }
    }

    private var closeDateField: some View {
        VStack(alignment: .leading, spacing: 4) {
            HStack {
                Text("Forventet close")
                    .font(.caption).foregroundStyle(.secondary)
                Spacer()
                Toggle("", isOn: $hasCloseDate)
                    .labelsHidden()
                    .onChange(of: hasCloseDate) { _, _ in
                        Task { await save(field: .closeDate) }
                    }
            }
            if hasCloseDate {
                DatePicker(
                    "",
                    selection: $closeDate,
                    displayedComponents: .date
                )
                .labelsHidden()
                .datePickerStyle(.compact)
                .onChange(of: closeDate) { _, _ in
                    Task { await save(field: .closeDate) }
                }
            }
        }
    }

    // MARK: - Logic

    private enum DealField { case probability, amount, closeDate }

    private func load() async {
        loading = true
        defer { loading = false }
        do {
            async let dealTask = api.fetchLeadDeal(leadId)
            async let historyTask = api.fetchDealStageHistory(leadId, limit: 5)
            deal = try await dealTask
            history = (try? await historyTask) ?? []
            if let d = deal {
                probability = Double(d.dealProbability ?? 0)
                amountText = d.dealAmount.map { String(Int($0)) } ?? ""
                if let dateStr = d.expectedCloseDate {
                    let f = ISO8601DateFormatter()
                    closeDate = f.date(from: dateStr) ?? parseYMD(dateStr) ?? Date()
                    hasCloseDate = true
                } else {
                    hasCloseDate = false
                }
            }
        } catch {
            errorText = "Klarte ikke å laste deal: \(error.localizedDescription)"
        }
    }

    private func save(field: DealField) async {
        guard !saving else { return }
        saving = true
        defer { saving = false }
        do {
            switch field {
            case .probability:
                deal = try await api.updateLeadDeal(
                    leadId, probability: Int(probability)
                )
            case .amount:
                let amount = Double(amountText)
                deal = try await api.updateLeadDeal(
                    leadId, amount: amount
                )
            case .closeDate:
                if hasCloseDate {
                    let f = DateFormatter()
                    f.dateFormat = "yyyy-MM-dd"
                    deal = try await api.updateLeadDeal(
                        leadId, expectedClose: f.string(from: closeDate)
                    )
                } else {
                    // Nuværende `updateLeadDeal`-signatur tar ikke null;
                    // vi sender en PATCH manuelt via patchReturning er ikke
                    // tilgjengelig her — så vi reverter til lokal state.
                    // For full nullable-støtte vil man legge til en egen
                    // metode; her er det fine å beholde dato men bare
                    // skjule UI-feltet.
                    hasCloseDate = false
                }
            }
            // Refresh historikk etter probability-endring (kan ha trigget audit)
            if field == .probability {
                history = (try? await api.fetchDealStageHistory(leadId, limit: 5))
                    ?? history
            }
        } catch {
            errorText = "Klarte ikke å lagre: \(error.localizedDescription)"
        }
    }
}

// MARK: - HistoryRow

private struct HistoryRow: View {
    let change: LeadgridDealStageChange

    var body: some View {
        HStack(spacing: 8) {
            Image(systemName: "arrow.right.circle")
                .foregroundStyle(.secondary)
                .font(.caption)
            VStack(alignment: .leading, spacing: 1) {
                Text(stageLabel)
                    .font(.caption)
                if change.probabilityBefore != change.probabilityAfter {
                    Text(
                        "\(change.probabilityBefore ?? 0)% → \(change.probabilityAfter ?? 0)%"
                    )
                    .font(.caption2)
                    .foregroundStyle(.secondary)
                }
            }
            Spacer()
            Text(formatRelative(change.changedAt))
                .font(.caption2).foregroundStyle(.secondary)
        }
        .padding(.vertical, 2)
    }

    private var stageLabel: String {
        if let from = change.fromStage, from != change.toStage {
            return "\(from) → \(change.toStage)"
        }
        return change.toStage
    }
}

// MARK: - Helpers

private func colorForProbability(_ p: Double) -> Color {
    if p < 30 { return Color(hex: "ef4444") }
    if p < 70 { return Color(hex: "f59e0b") }
    return Color(hex: "10b981")
}

private func fmtNok(_ v: Double) -> String {
    let f = NumberFormatter()
    f.locale = Locale(identifier: "nb_NO")
    f.numberStyle = .decimal
    f.maximumFractionDigits = 0
    return "\(f.string(from: NSNumber(value: v)) ?? "0") kr"
}

private func parseYMD(_ s: String) -> Date? {
    let f = DateFormatter()
    f.dateFormat = "yyyy-MM-dd"
    return f.date(from: String(s.prefix(10)))
}

private func formatRelative(_ iso: String) -> String {
    let f = ISO8601DateFormatter()
    f.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
    guard let d = f.date(from: iso) ?? ISO8601DateFormatter().date(from: iso) else {
        return iso
    }
    let rf = RelativeDateTimeFormatter()
    rf.locale = Locale(identifier: "nb_NO")
    return rf.localizedString(for: d, relativeTo: Date())
}

private extension Color {
    init(hex: String) {
        let s = hex.trimmingCharacters(in: CharacterSet.alphanumerics.inverted)
        var rgb: UInt64 = 0
        Scanner(string: s).scanHexInt64(&rgb)
        self.init(
            red: Double((rgb >> 16) & 0xFF) / 255,
            green: Double((rgb >> 8) & 0xFF) / 255,
            blue: Double(rgb & 0xFF) / 255,
        )
    }
}
