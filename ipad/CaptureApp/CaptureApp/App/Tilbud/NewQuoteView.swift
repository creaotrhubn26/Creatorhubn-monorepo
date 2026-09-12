import SwiftUI

/// Draft line item the photographer edits before the quote is created.
/// Kept as a `@MainActor` view-side model so SwiftUI re-renders the
/// computed total as the photographer types.
@MainActor
@Observable
private final class DraftLineItem: Identifiable {
    let id = UUID()
    var description: String = ""
    var quantityText: String = "1"
    var unitPriceText: String = ""

    var quantity: Double { DraftLineItem.parse(quantityText) ?? 0 }
    var unitPrice: Double { DraftLineItem.parse(unitPriceText) ?? 0 }
    var total: Double { quantity * unitPrice }

    static func parse(_ text: String) -> Double? {
        let normalized = text
            .trimmingCharacters(in: .whitespaces)
            .replacingOccurrences(of: " ", with: "")
            .replacingOccurrences(of: ",", with: ".")
        return Double(normalized)
    }
}

@MainActor
@Observable
private final class NewQuoteModel {
    var clientName = ""
    var clientEmail = ""
    var title = ""
    var description = ""
    var items: [DraftLineItem] = [DraftLineItem()]

    var working = false
    var errorMessage: String?

    var grandTotal: Double { items.reduce(0) { $0 + $1.total } }

    var canSubmit: Bool {
        !clientName.trimmingCharacters(in: .whitespaces).isEmpty
            && !title.trimmingCharacters(in: .whitespaces).isEmpty
            && items.contains { !$0.description.trimmingCharacters(in: .whitespaces).isEmpty && $0.total > 0 }
            && !working
    }

    func addItem() { items.append(DraftLineItem()) }

    func removeItem(_ item: DraftLineItem) {
        items.removeAll { $0.id == item.id }
        if items.isEmpty { items.append(DraftLineItem()) }
    }

    /// Create the quote. Returns true on success so the view can dismiss.
    func submit() async -> Bool {
        guard let client = DashboardClient.make() else {
            errorMessage = DashboardError.signedOut.localizedDescription
            return false
        }
        working = true
        defer { working = false }
        errorMessage = nil

        let services: [QuoteService] = items
            .filter { !$0.description.trimmingCharacters(in: .whitespaces).isEmpty }
            .map { item in
                QuoteService(
                    description: item.description.trimmingCharacters(in: .whitespaces),
                    quantity: item.quantity,
                    unitPrice: item.unitPrice,
                    totalPrice: item.total,
                )
            }

        do {
            try await client.createQuote(
                clientName: clientName.trimmingCharacters(in: .whitespaces),
                clientEmail: clientEmail.trimmingCharacters(in: .whitespaces),
                title: title.trimmingCharacters(in: .whitespaces),
                description: description.trimmingCharacters(in: .whitespaces),
                services: services,
                totalAmount: grandTotal,
                status: "draft",
            )
            return true
        } catch {
            errorMessage = (error as? DashboardError)?.localizedDescription ?? error.localizedDescription
            return false
        }
    }
}

struct NewQuoteView: View {
    @State private var model = NewQuoteModel()
    @Environment(\.dismiss) private var dismiss
    /// Called after a successful create so the list can refresh.
    let onCreated: () async -> Void

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 16) {
                    clientCard
                    detailsCard
                    itemsCard
                    totalCard
                    if let message = model.errorMessage {
                        Text(message)
                            .font(.caption)
                            .foregroundStyle(CHTheme.danger)
                    }
                }
                .padding()
            }
            .frame(maxWidth: .infinity)
            .background(CHTheme.bg.ignoresSafeArea())
            .navigationTitle("Nytt tilbud")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Avbryt") { dismiss() }
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Lagre") {
                        Task {
                            if await model.submit() {
                                await onCreated()
                                dismiss()
                            }
                        }
                    }
                    .disabled(!model.canSubmit)
                }
            }
        }
        .chBranded()
    }

    // MARK: - Cards

    private var clientCard: some View {
        CHCard {
            VStack(alignment: .leading, spacing: 12) {
                Text("Klient").font(.headline).foregroundStyle(CHTheme.textPrimary)
                CHField(title: "Navn", text: $model.clientName, placeholder: "Klientens navn")
                CHField(title: "E-post", text: $model.clientEmail, placeholder: "navn@eksempel.no")
                    .keyboardType(.emailAddress)
                    .textInputAutocapitalization(.never)
            }
        }
    }

    private var detailsCard: some View {
        CHCard {
            VStack(alignment: .leading, spacing: 12) {
                Text("Detaljer").font(.headline).foregroundStyle(CHTheme.textPrimary)
                CHField(title: "Tittel", text: $model.title, placeholder: "F.eks. Bryllupsfotografering")
                VStack(alignment: .leading, spacing: 6) {
                    Text("Beskrivelse").font(.caption).foregroundStyle(CHTheme.textMuted)
                    TextField("Valgfri beskrivelse", text: $model.description, axis: .vertical)
                        .lineLimit(2...5)
                        .textFieldStyle(.plain)
                        .padding(10)
                        .background(CHTheme.surfaceElevated, in: RoundedRectangle(cornerRadius: 8))
                        .foregroundStyle(CHTheme.textPrimary)
                }
            }
        }
    }

    private var itemsCard: some View {
        CHCard {
            VStack(alignment: .leading, spacing: 14) {
                HStack {
                    Text("Linjeposter").font(.headline).foregroundStyle(CHTheme.textPrimary)
                    Spacer()
                    Button {
                        model.addItem()
                    } label: {
                        Label("Legg til", systemImage: "plus")
                            .font(.caption)
                    }
                    .buttonStyle(.bordered)
                    .controlSize(.small)
                }
                ForEach(model.items) { item in
                    LineItemEditor(item: item) { model.removeItem(item) }
                    if item.id != model.items.last?.id {
                        Divider().overlay(CHTheme.border)
                    }
                }
            }
        }
    }

    private var totalCard: some View {
        CHCard {
            HStack {
                Text("Totalt").font(.headline).foregroundStyle(CHTheme.textPrimary)
                Spacer()
                Text(QuoteFormat.kr(model.grandTotal))
                    .font(.title3.bold().monospacedDigit())
                    .foregroundStyle(CHTheme.accent)
            }
        }
    }
}

// MARK: - Line item editor row

private struct LineItemEditor: View {
    @Bindable var item: DraftLineItem
    let onDelete: () -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack {
                TextField("Beskrivelse", text: $item.description)
                    .textFieldStyle(.plain)
                    .foregroundStyle(CHTheme.textPrimary)
                Button(role: .destructive, action: onDelete) {
                    Image(systemName: "trash")
                        .foregroundStyle(CHTheme.danger)
                }
                .buttonStyle(.plain)
            }
            HStack(spacing: 10) {
                fieldBox("Antall") {
                    TextField("1", text: $item.quantityText)
                        .keyboardType(.decimalPad)
                }
                fieldBox("Pris (kr)") {
                    TextField("0", text: $item.unitPriceText)
                        .keyboardType(.decimalPad)
                }
                VStack(alignment: .leading, spacing: 4) {
                    Text("Sum").font(.caption2).foregroundStyle(CHTheme.textMuted)
                    Text(QuoteFormat.kr(item.total))
                        .font(.subheadline.monospacedDigit())
                        .foregroundStyle(CHTheme.textPrimary)
                        .frame(maxWidth: .infinity, alignment: .leading)
                }
            }
        }
        .padding(.vertical, 2)
    }

    private func fieldBox(_ label: String, @ViewBuilder _ content: () -> some View) -> some View {
        VStack(alignment: .leading, spacing: 4) {
            Text(label).font(.caption2).foregroundStyle(CHTheme.textMuted)
            content()
                .textFieldStyle(.plain)
                .foregroundStyle(CHTheme.textPrimary)
                .padding(8)
                .background(CHTheme.surfaceElevated, in: RoundedRectangle(cornerRadius: 8))
        }
        .frame(maxWidth: .infinity)
    }
}

// MARK: - Branded labelled field

private struct CHField: View {
    let title: String
    @Binding var text: String
    var placeholder: String = ""

    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            Text(title).font(.caption).foregroundStyle(CHTheme.textMuted)
            TextField(placeholder, text: $text)
                .textFieldStyle(.plain)
                .padding(10)
                .background(CHTheme.surfaceElevated, in: RoundedRectangle(cornerRadius: 8))
                .foregroundStyle(CHTheme.textPrimary)
        }
    }
}
