// NewFollowUpSheet.swift
//
// Leadgrid-branded modal for å opprette en ny oppfølging. Åpnes fra
// kalenderens quick-action «Ny oppfølging» i Oversikt-headeren, og
// pre-fyller dato/tid fra det som ble valgt i LeadgridDatePickerSheet.
//
// Innhold:
//   - Header: valgt dato + tid (redigerbar via nested LeadgridDatePicker)
//   - Lead-søk (filtrer navn / firma / by)
//   - Grid av lead-kort — tap for å velge
//   - Handlings-tekst («Hva skal skje?»)
//   - Lagre-knapp (per nå: fyrer callback + lokal toast — backend-
//     PATCH kommer når /leads/:id/follow-up-endpoint bygges)

import SwiftUI

// MARK: - Farge-palett (matcher LeadgridDatePicker / OversiktView Brand)

private enum NFS {
    static let bg = Color(red: 0.05, green: 0.04, blue: 0.10)
    static let card = Color(red: 0.10, green: 0.09, blue: 0.16)
    static let cardHi = Color(red: 0.13, green: 0.11, blue: 0.20)
    static let stroke = Color.white.opacity(0.10)
    static let purple = Color(red: 0.66, green: 0.32, blue: 0.99)
    static let purpleLight = Color(red: 0.75, green: 0.45, blue: 1.0)
    static let blue = Color(red: 0.34, green: 0.60, blue: 0.98)
    static let green = Color(red: 0.20, green: 0.85, blue: 0.60)
    static let textDim = Color.white.opacity(0.55)
    static let textTertiary = Color.white.opacity(0.30)
}

/// Data som sendes tilbake ved lagre.
struct NewFollowUpPayload: Sendable {
    let leadId: String
    let leadName: String
    let date: Date
    let action: String
}

struct NewFollowUpSheet: View {
    let initialDate: Date
    let leads: [LeadModel]
    let onSave: (NewFollowUpPayload) -> Void

    @Environment(\.dismiss) private var dismiss
    @State private var selectedLeadId: String?
    @State private var actionText: String = ""
    @State private var followUpDate: Date
    @State private var showDatePicker: Bool = false
    @State private var search: String = ""

    init(
        initialDate: Date,
        leads: [LeadModel],
        onSave: @escaping (NewFollowUpPayload) -> Void
    ) {
        self.initialDate = initialDate
        self.leads = leads
        self.onSave = onSave
        _followUpDate = State(initialValue: initialDate)
    }

    private var filteredLeads: [LeadModel] {
        let q = search.trimmingCharacters(in: .whitespaces).lowercased()
        guard !q.isEmpty else { return leads }
        return leads.filter { lead in
            lead.name.lowercased().contains(q)
            || (lead.company?.lowercased().contains(q) ?? false)
            || (lead.city?.lowercased().contains(q) ?? false)
        }
    }

    private var selectedLead: LeadModel? {
        guard let id = selectedLeadId else { return nil }
        return leads.first { $0.id == id }
    }

    private var canSave: Bool {
        selectedLeadId != nil && !actionText.trimmingCharacters(in: .whitespaces).isEmpty
    }

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 18) {
                    datetimeCard
                    leadPickerCard
                    actionCard
                }
                .padding(18)
            }
            .background(NFS.bg)
            .navigationTitle("Ny oppfølging")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button {
                        dismiss()
                    } label: {
                        Image(systemName: "xmark")
                            .font(.system(size: 14, weight: .semibold))
                    }
                    .accessibilityLabel("Avbryt")
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Lagre") { save() }
                        .fontWeight(.bold)
                        .foregroundStyle(canSave ? NFS.purpleLight : NFS.textTertiary)
                        .disabled(!canSave)
                }
            }
        }
        .presentationDetents([.large])
        .presentationDragIndicator(.visible)
        .sheet(isPresented: $showDatePicker) {
            LeadgridDatePickerSheet(
                initialDate: followUpDate,
                showTime: true,
                onConfirm: { d in
                    followUpDate = d
                    showDatePicker = false
                },
                onCancel: { showDatePicker = false }
            )
        }
    }

    // MARK: - Sections

    private var datetimeCard: some View {
        Button {
            showDatePicker = true
        } label: {
            HStack(spacing: 12) {
                ZStack {
                    Circle().fill(NFS.purple.opacity(0.20))
                    Image(systemName: "calendar.badge.clock")
                        .font(.system(size: 15, weight: .bold))
                        .foregroundStyle(NFS.purpleLight)
                }
                .frame(width: 36, height: 36)
                .overlay(Circle().strokeBorder(NFS.purple.opacity(0.35), lineWidth: 1))
                VStack(alignment: .leading, spacing: 2) {
                    Text("NÅR")
                        .font(.system(size: 9, weight: .black, design: .rounded))
                        .tracking(1.0)
                        .foregroundStyle(NFS.textDim)
                    Text(formatDateTime(followUpDate))
                        .font(.system(size: 15, weight: .semibold))
                        .foregroundStyle(.white)
                }
                Spacer()
                Image(systemName: "chevron.right")
                    .font(.system(size: 11, weight: .bold))
                    .foregroundStyle(NFS.textTertiary)
            }
            .padding(14)
            .background(NFS.card, in: RoundedRectangle(cornerRadius: 14))
            .overlay(RoundedRectangle(cornerRadius: 14).strokeBorder(NFS.stroke, lineWidth: 1))
        }
        .buttonStyle(.plain)
    }

    private var leadPickerCard: some View {
        VStack(alignment: .leading, spacing: 10) {
            Text("HVILKEN LEAD?")
                .font(.system(size: 9, weight: .black, design: .rounded))
                .tracking(1.0)
                .foregroundStyle(NFS.textDim)
            HStack(spacing: 10) {
                Image(systemName: "magnifyingglass")
                    .font(.system(size: 13, weight: .semibold))
                    .foregroundStyle(NFS.textTertiary)
                TextField("Søk navn, firma, by …", text: $search)
                    .textFieldStyle(.plain)
                    .foregroundStyle(.white)
            }
            .padding(12)
            .background(NFS.card, in: RoundedRectangle(cornerRadius: 11))
            .overlay(RoundedRectangle(cornerRadius: 11).strokeBorder(NFS.stroke, lineWidth: 1))

            if filteredLeads.isEmpty {
                emptyLeadRow
            } else {
                VStack(spacing: 6) {
                    ForEach(filteredLeads.prefix(6)) { lead in
                        leadRow(lead)
                    }
                    if filteredLeads.count > 6 {
                        Text("+ \(filteredLeads.count - 6) flere — søk for å innsnevre")
                            .font(.system(size: 10, weight: .medium))
                            .foregroundStyle(NFS.textDim)
                            .padding(.top, 4)
                    }
                }
            }
        }
    }

    private func leadRow(_ lead: LeadModel) -> some View {
        let isSelected = lead.id == selectedLeadId
        return Button {
            selectedLeadId = isSelected ? nil : lead.id
        } label: {
            HStack(spacing: 12) {
                ZStack {
                    Circle().fill(NFS.blue.opacity(0.20))
                    Text(String(lead.name.prefix(2)).uppercased())
                        .font(.system(size: 12, weight: .bold, design: .rounded))
                        .foregroundStyle(.white)
                }
                .frame(width: 34, height: 34)
                .overlay(Circle().strokeBorder(NFS.blue.opacity(0.35), lineWidth: 1))
                VStack(alignment: .leading, spacing: 1) {
                    Text(lead.name)
                        .font(.system(size: 13, weight: .semibold))
                        .foregroundStyle(.white)
                        .lineLimit(1)
                    if let city = lead.city, !city.isEmpty {
                        Text(city)
                            .font(.system(size: 11))
                            .foregroundStyle(NFS.textDim)
                            .lineLimit(1)
                    }
                }
                Spacer()
                if isSelected {
                    Image(systemName: "checkmark.circle.fill")
                        .font(.system(size: 18, weight: .bold))
                        .foregroundStyle(NFS.green)
                }
            }
            .padding(10)
            .background(
                (isSelected ? NFS.purple.opacity(0.15) : NFS.card),
                in: RoundedRectangle(cornerRadius: 10)
            )
            .overlay(
                RoundedRectangle(cornerRadius: 10).strokeBorder(
                    isSelected ? NFS.purple.opacity(0.55) : NFS.stroke,
                    lineWidth: 1
                )
            )
        }
        .buttonStyle(.plain)
    }

    private var emptyLeadRow: some View {
        HStack(spacing: 10) {
            Image(systemName: "person.slash")
                .font(.system(size: 14, weight: .semibold))
                .foregroundStyle(NFS.textTertiary)
            Text("Ingen leads matcher søket")
                .font(.system(size: 12))
                .foregroundStyle(NFS.textDim)
        }
        .padding(14)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(NFS.card, in: RoundedRectangle(cornerRadius: 10))
        .overlay(RoundedRectangle(cornerRadius: 10).strokeBorder(NFS.stroke, lineWidth: 1))
    }

    private var actionCard: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text("HVA SKAL SKJE?")
                .font(.system(size: 9, weight: .black, design: .rounded))
                .tracking(1.0)
                .foregroundStyle(NFS.textDim)
            TextField("F.eks. Ring for å avtale demo …",
                      text: $actionText,
                      axis: .vertical)
                .textFieldStyle(.plain)
                .foregroundStyle(.white)
                .lineLimit(3, reservesSpace: true)
                .padding(12)
                .background(NFS.card, in: RoundedRectangle(cornerRadius: 11))
                .overlay(RoundedRectangle(cornerRadius: 11).strokeBorder(NFS.stroke, lineWidth: 1))
        }
    }

    // MARK: - Save

    private func save() {
        guard let lead = selectedLead else { return }
        onSave(NewFollowUpPayload(
            leadId: lead.id,
            leadName: lead.name,
            date: followUpDate,
            action: actionText.trimmingCharacters(in: .whitespaces)
        ))
        dismiss()
    }

    // MARK: - Helpers

    private func formatDateTime(_ d: Date) -> String {
        let f = DateFormatter()
        f.locale = Locale(identifier: "nb_NO")
        f.timeZone = TimeZone(identifier: "Europe/Oslo") ?? .current
        f.dateFormat = "d. MMMM yyyy, HH:mm"
        return f.string(from: d)
    }
}
