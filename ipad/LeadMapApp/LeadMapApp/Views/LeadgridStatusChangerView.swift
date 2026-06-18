// LeadgridStatusChangerView.swift
//
// Status-changer for Leadgrid CRM på iPad. Erstatter den enkle
// LeadStatus-enum med full Leadgrid-paritet:
//   - new → contacted → meeting_booked → proposal_sent
//     → negotiating → won | lost | archived | paused
//
// Won åpner WonDialogSheet (beløp + recurring + note + 🎉)
// Lost åpner LostDialogSheet (påkrevd årsak fra enum + valgfri detalj)

import SwiftUI

enum LeadgridCrmStatus: String, CaseIterable, Identifiable {
    case new
    case contacted
    case meetingBooked = "meeting_booked"
    case proposalSent = "proposal_sent"
    case negotiating
    case won
    case lost
    case paused
    case archived

    var id: String { rawValue }

    var label: String {
        switch self {
        case .new: return "Ny"
        case .contacted: return "Kontaktet"
        case .meetingBooked: return "Møte booket"
        case .proposalSent: return "Forslag sendt"
        case .negotiating: return "I forhandling"
        case .won: return "Vunnet 🎉"
        case .lost: return "Tapt"
        case .paused: return "Pauset"
        case .archived: return "Arkivert"
        }
    }

    var color: Color {
        switch self {
        case .new: return Color.gray
        case .contacted: return Color.blue
        case .meetingBooked: return Color.purple
        case .proposalSent: return Color.orange
        case .negotiating: return Color(red: 1, green: 0.72, blue: 0.42)
        case .won: return Color(red: 0.61, green: 0.88, blue: 0.36)
        case .lost: return Color(red: 0.97, green: 0.44, blue: 0.44)
        case .paused: return Color.secondary
        case .archived: return Color.secondary
        }
    }

    var systemIcon: String {
        switch self {
        case .new: return "circle"
        case .contacted: return "phone.fill"
        case .meetingBooked: return "calendar"
        case .proposalSent: return "doc.text"
        case .negotiating: return "hand.raised.fill"
        case .won: return "checkmark.circle.fill"
        case .lost: return "xmark.circle.fill"
        case .paused: return "pause.circle"
        case .archived: return "archivebox"
        }
    }
}

enum LeadgridLostReason: String, CaseIterable, Identifiable {
    case noBudget = "no_budget"
    case noDecisionMaker = "no_decision_maker"
    case noTimeline = "no_timeline"
    case competitor
    case badFit = "bad_fit"
    case unresponsive
    case tooExpensive = "too_expensive"
    case other

    var id: String { rawValue }

    var label: String {
        switch self {
        case .noBudget: return "Ingen budsjett"
        case .noDecisionMaker: return "Ingen avgjørelsestaker"
        case .noTimeline: return "Ingen tidshorisont"
        case .competitor: return "Tapt til konkurrent"
        case .badFit: return "Dårlig fit"
        case .unresponsive: return "Ikke responderer"
        case .tooExpensive: return "For dyrt"
        case .other: return "Annet"
        }
    }
}

struct LeadgridStatusChangerView: View {
    let customerId: String
    let customerName: String
    @Binding var currentStatus: String
    let api: APIClient
    @Environment(\.dismiss) private var dismiss

    @State private var showingWon = false
    @State private var showingLost = false
    @State private var submitting = false
    @State private var errorText: String?

    var current: LeadgridCrmStatus? {
        LeadgridCrmStatus(rawValue: currentStatus)
    }

    var body: some View {
        NavigationStack {
            List {
                Section {
                    HStack {
                        Image(systemName: current?.systemIcon ?? "circle")
                            .foregroundStyle(current?.color ?? .gray)
                        Text(current?.label ?? currentStatus)
                            .font(.headline)
                    }
                    .padding(.vertical, 4)
                } header: { Text("Nåværende status") }

                Section {
                    ForEach(LeadgridCrmStatus.allCases) { status in
                        Button {
                            pickStatus(status)
                        } label: {
                            HStack {
                                Image(systemName: status.systemIcon)
                                    .foregroundStyle(status.color)
                                    .frame(width: 24)
                                Text(status.label)
                                Spacer()
                                if status.rawValue == currentStatus {
                                    Text("nåværende")
                                        .font(.caption)
                                        .foregroundStyle(.secondary)
                                }
                            }
                        }
                        .disabled(submitting)
                    }
                } header: { Text("Bytt til") }

                if let errorText {
                    Section {
                        Text(errorText)
                            .font(.caption)
                            .foregroundStyle(.red)
                    }
                }
            }
            .navigationTitle(customerName)
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Lukk") { dismiss() }
                }
            }
            .sheet(isPresented: $showingWon) {
                WonDialogSheet(customerName: customerName) { wonAmountOere, wonRecurringOere, wonNote in
                    Task { await submit(.won,
                                         wonAmountOere: wonAmountOere,
                                         wonRecurringOere: wonRecurringOere,
                                         wonNote: wonNote) }
                }
            }
            .sheet(isPresented: $showingLost) {
                LostDialogSheet(customerName: customerName) { reason, detail in
                    Task { await submit(.lost, lostReason: reason.rawValue,
                                         lostReasonDetail: detail) }
                }
            }
        }
    }

    private func pickStatus(_ status: LeadgridCrmStatus) {
        if status == .won { showingWon = true; return }
        if status == .lost { showingLost = true; return }
        Task { await submit(status) }
    }

    private func submit(
        _ status: LeadgridCrmStatus,
        wonAmountOere: Int? = nil,
        wonRecurringOere: Int? = nil,
        wonNote: String? = nil,
        lostReason: String? = nil,
        lostReasonDetail: String? = nil,
    ) async {
        submitting = true
        errorText = nil
        do {
            try await api.updateLeadgridStatus(
                customerId: customerId,
                toStatus: status.rawValue,
                wonAmountOere: wonAmountOere,
                wonRecurringOere: wonRecurringOere,
                wonNote: wonNote,
                lostReason: lostReason,
                lostReasonDetail: lostReasonDetail,
            )
            await MainActor.run {
                currentStatus = status.rawValue
                submitting = false
                dismiss()
            }
        } catch {
            await MainActor.run {
                errorText = "Kunne ikke endre status: \(error.localizedDescription)"
                submitting = false
            }
        }
    }
}

// ============================================================
// MARK: - Won Dialog
// ============================================================

struct WonDialogSheet: View {
    let customerName: String
    let onSubmit: (_ wonAmountOere: Int?, _ wonRecurringOere: Int?, _ wonNote: String?) -> Void
    @Environment(\.dismiss) private var dismiss

    @State private var amountString = ""
    @State private var recurringString = ""
    @State private var note = ""

    var body: some View {
        NavigationStack {
            Form {
                Section {
                    Label("Gratulerer! 🎉", systemImage: "checkmark.circle.fill")
                        .foregroundStyle(.green)
                        .font(.headline)
                    Text("Fyll inn deal-info så får hele teamet beskjed.")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }
                Section {
                    HStack {
                        TextField("0", text: $amountString)
                            .keyboardType(.numberPad)
                        Text("kr").foregroundStyle(.secondary)
                    }
                } header: { Text("Engangs-honorar") }
                  footer: { Text("Hva ble det betalt i engangs-honorar?") }

                Section {
                    HStack {
                        TextField("0", text: $recurringString)
                            .keyboardType(.numberPad)
                        Text("kr/mnd").foregroundStyle(.secondary)
                    }
                } header: { Text("Månedlig recurring") }
                  footer: { Text("MRR (månedlig recurring revenue)") }

                Section {
                    TextField("Eks: Signert 12-mnd avtale, kicker i juli",
                              text: $note, axis: .vertical)
                        .lineLimit(2...4)
                } header: { Text("Notat (valgfri)") }
            }
            .navigationTitle("Marker som vunnet")
        .marketingDirectorBackdrop(.wonLost)
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Avbryt") { dismiss() }
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Marker vunnet") {
                        let amt = Int(amountString).map { $0 * 100 }
                        let rec = Int(recurringString).map { $0 * 100 }
                        onSubmit(amt, rec, note.isEmpty ? nil : note)
                        dismiss()
                    }
                    .bold()
                    .foregroundStyle(.green)
                }
            }
            .presentationDetents([.medium, .large])
        }
    }
}

// ============================================================
// MARK: - Lost Dialog
// ============================================================

struct LostDialogSheet: View {
    let customerName: String
    let onSubmit: (_ reason: LeadgridLostReason, _ detail: String?) -> Void
    @Environment(\.dismiss) private var dismiss

    @State private var picked: LeadgridLostReason?
    @State private var detail = ""

    var body: some View {
        NavigationStack {
            Form {
                Section {
                    Text("Vi bruker tapt-årsaker til læring og statistikk.")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }
                Section {
                    ForEach(LeadgridLostReason.allCases) { reason in
                        Button {
                            picked = reason
                        } label: {
                            HStack {
                                Text(reason.label)
                                    .foregroundStyle(.primary)
                                Spacer()
                                if picked == reason {
                                    Image(systemName: "checkmark")
                                        .foregroundStyle(.red)
                                }
                            }
                        }
                    }
                } header: { Text("Årsak (påkrevd)") }

                Section {
                    TextField("Eks: Valgte konkurrent X på pris",
                              text: $detail, axis: .vertical)
                        .lineLimit(2...4)
                } header: { Text("Detalj (valgfri)") }
            }
            .navigationTitle("Marker som tapt")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Avbryt") { dismiss() }
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Marker tapt") {
                        if let r = picked {
                            onSubmit(r, detail.isEmpty ? nil : detail)
                            dismiss()
                        }
                    }
                    .bold()
                    .foregroundStyle(.red)
                    .disabled(picked == nil)
                }
            }
            .presentationDetents([.medium, .large])
        }
    }
}
