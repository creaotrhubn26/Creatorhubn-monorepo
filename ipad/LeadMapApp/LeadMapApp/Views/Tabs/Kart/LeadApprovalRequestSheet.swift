import SwiftUI

/// Producer for the sales manager approval queue. A stable idempotency key is
/// created with the sheet, so a retry after a lost response cannot create a
/// second approval case.
struct LeadApprovalRequestSheet: View {
    @Environment(\.dismiss) private var dismiss
    @Environment(AppState.self) private var appState
    let leadId: String
    let leadName: String
    let estimatedValue: Double?

    @State private var kind = "deal"
    @State private var title = ""
    @State private var amount = ""
    @State private var rationale = ""
    @State private var idempotencyKey = UUID().uuidString
    @State private var saving = false
    @State private var errorMessage: String?

    var body: some View {
        NavigationStack {
            Form {
                Section("Godkjenning") {
                    Picker("Type", selection: $kind) {
                        Text("Avtale").tag("deal")
                        Text("Rabatt").tag("discount")
                        Text("Særvilkår").tag("special")
                    }
                    TextField("Tittel", text: $title)
                    TextField("Beløp i NOK", text: $amount).keyboardType(.decimalPad)
                    TextField("Hvorfor bør dette godkjennes?", text: $rationale, axis: .vertical)
                        .lineLimit(3...7)
                }
                Section {
                    Label("Saken kobles til \(leadName) og dukker umiddelbart opp i salgssjefens arbeidskø.", systemImage: "link")
                        .font(.appScaled(size: 11))
                }
            }
            .navigationTitle("Be om godkjenning")
            .toolbar {
                ToolbarItem(placement: .cancellationAction) { Button("Avbryt") { dismiss() } }
                ToolbarItem(placement: .confirmationAction) {
                    Button(saving ? "Sender …" : "Send") { Task { await submit() } }
                        .disabled(saving || title.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty)
                }
            }
            .alert("Kunne ikke sende", isPresented: Binding(
                get: { errorMessage != nil }, set: { if !$0 { errorMessage = nil } }
            )) { Button("OK", role: .cancel) {} } message: { Text(errorMessage ?? "Ukjent feil") }
            .onAppear {
                if title.isEmpty { title = "Godkjenn avtale med \(leadName)" }
                if amount.isEmpty, let estimatedValue { amount = String(Int(estimatedValue)) }
            }
        }
    }

    @MainActor
    private func submit() async {
        guard let api = appState.api else {
            errorMessage = "Du må være innlogget."
            return
        }
        saving = true
        defer { saving = false }
        do {
            try await api.requestSalesManagementApproval(
                kind: kind,
                title: title.trimmingCharacters(in: .whitespacesAndNewlines),
                customerName: leadName,
                amountNok: Double(amount.replacingOccurrences(of: ",", with: ".")) ?? 0,
                rationale: rationale.trimmingCharacters(in: .whitespacesAndNewlines),
                sourceType: "lead",
                sourceId: leadId,
                idempotencyKey: idempotencyKey
            )
            dismiss()
        } catch {
            errorMessage = error.localizedDescription
        }
    }
}
