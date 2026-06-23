// LeadgridSetGoalSheet.swift
//
// Sheet for å sette/oppdatere månedlige salgsmål + daglige
// aktivitetsmål for Daniels Momentum Engine. Backend regner
// ut hvor mange leads som trengs basert på konversjonsrater.
//
// Endepunkter:
//   - GET  /api/leadgrid/momentum/goal
//   - POST /api/leadgrid/momentum/goal

import SwiftUI

struct LeadgridSetGoalSheet: View {
    let api: APIClient
    let onSaved: () -> Void
    @Environment(\.dismiss) private var dismiss

    @State private var goal: LeadgridSalesGoal?
    @State private var loading = true
    @State private var saving = false
    @State private var errorText: String?

    // Editable fields
    @State private var revenueTarget: String = ""
    @State private var dealsTarget: Int = 3
    @State private var meetingsTarget: Int = 10
    @State private var dailyContacts: Int = 3
    @State private var dailyFollowups: Int = 5
    @State private var dailyMeetings: Int = 1
    @State private var dailyPipelineMoves: Int = 2

    var body: some View {
        NavigationStack {
            Form {
                Section("Månedsmål") {
                    HStack {
                        Text("Revenue (NOK)")
                        TextField("250 000", text: $revenueTarget)
                            .keyboardType(.numberPad)
                            .multilineTextAlignment(.trailing)
                    }
                    Stepper("Nye kunder: \(dealsTarget)", value: $dealsTarget, in: 1...100)
                    Stepper("Møter: \(meetingsTarget)", value: $meetingsTarget, in: 1...500)
                }

                Section("Daglige aktivitetsmål") {
                    Stepper("Nye kontakter: \(dailyContacts)", value: $dailyContacts, in: 1...50)
                    Stepper("Oppfølginger: \(dailyFollowups)", value: $dailyFollowups, in: 0...50)
                    Stepper("Møter: \(dailyMeetings)", value: $dailyMeetings, in: 0...10)
                    Stepper("Pipeline-flytt: \(dailyPipelineMoves)", value: $dailyPipelineMoves, in: 0...20)
                }

                if let g = goal, let needed = g.monthlyLeadsNeeded {
                    Section {
                        Label("Du trenger ca. \(needed) leads denne måneden", systemImage: "info.circle")
                            .font(.caption)
                            .foregroundStyle(.secondary)
                    }
                }

                if let errorText {
                    Section { Text(errorText).foregroundStyle(.red) }
                }
            }
            .navigationTitle("Sett salgsmål")
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Avbryt") { dismiss() }
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button(saving ? "Lagrer..." : "Lagre") {
                        Task { await save() }
                    }
                    .disabled(saving)
                }
            }
            .task { await load() }
        }
    }

    @MainActor
    private func load() async {
        loading = true
        do {
            let g = try await api.fetchSalesGoal()
            goal = g
            revenueTarget = g.revenueTarget.map { String(Int($0)) } ?? ""
            dealsTarget = g.dealsTarget ?? 3
            meetingsTarget = g.meetingsTarget ?? 10
            dailyContacts = g.dailyContactsTarget
            dailyFollowups = g.dailyFollowupsTarget
            dailyMeetings = g.dailyMeetingsTarget
            dailyPipelineMoves = g.dailyPipelineMovesTarget
        } catch {
            errorText = "Kunne ikke laste mål: \(error.localizedDescription)"
        }
        loading = false
    }

    @MainActor
    private func save() async {
        saving = true
        errorText = nil
        do {
            let revenue = Double(revenueTarget.replacingOccurrences(of: " ", with: ""))
            _ = try await api.saveSalesGoal(
                revenueTarget: revenue,
                dealsTarget: dealsTarget,
                meetingsTarget: meetingsTarget,
                dailyContactsTarget: dailyContacts,
                dailyFollowupsTarget: dailyFollowups,
                dailyMeetingsTarget: dailyMeetings,
                dailyPipelineMovesTarget: dailyPipelineMoves
            )
            onSaved()
            dismiss()
        } catch {
            errorText = "Kunne ikke lagre: \(error.localizedDescription)"
        }
        saving = false
    }
}
