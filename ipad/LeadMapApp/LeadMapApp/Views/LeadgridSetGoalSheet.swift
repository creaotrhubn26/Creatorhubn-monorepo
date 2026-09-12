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
    @Environment(AppState.self) private var appState
    let api: APIClient
    let projectId: String
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

    private var scopeIsCurrent: Bool {
        appState.activeLeadgridProjectId == projectId
    }

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
                    .disabled(saving || loading || !scopeIsCurrent)
                }
            }
            .task(id: appState.activeLeadgridProjectId) { await load() }
        }
    }

    @MainActor
    private func load() async {
        guard scopeIsCurrent else {
            goal = nil
            errorText = "Prosjektet ble endret. Lukk arket og åpne salgsmålet på nytt."
            loading = false
            return
        }
        loading = true
        errorText = nil
        defer {
            if scopeIsCurrent { loading = false }
        }
        do {
            let g = try await api.fetchSalesGoal(projectId: projectId)
            guard scopeIsCurrent, g.projectId == projectId else { return }
            goal = g
            revenueTarget = g.revenueTarget.map { String(Int($0)) } ?? ""
            dealsTarget = g.dealsTarget ?? 3
            meetingsTarget = g.meetingsTarget ?? 10
            dailyContacts = g.dailyContactsTarget
            dailyFollowups = g.dailyFollowupsTarget
            dailyMeetings = g.dailyMeetingsTarget
            dailyPipelineMoves = g.dailyPipelineMovesTarget
        } catch {
            guard !Task.isCancelled else { return }
            goal = nil
            if scopeIsCurrent {
                errorText = "Kunne ikke laste mål: \(error.localizedDescription)"
            }
        }
    }

    @MainActor
    private func save() async {
        guard scopeIsCurrent else {
            errorText = "Prosjektet ble endret. Målet ble ikke lagret."
            return
        }
        saving = true
        errorText = nil
        defer { saving = false }
        do {
            let revenue = Double(revenueTarget.replacingOccurrences(of: " ", with: ""))
            let saved = try await api.saveSalesGoal(
                projectId: projectId,
                revenueTarget: revenue,
                dealsTarget: dealsTarget,
                meetingsTarget: meetingsTarget,
                dailyContactsTarget: dailyContacts,
                dailyFollowupsTarget: dailyFollowups,
                dailyMeetingsTarget: dailyMeetings,
                dailyPipelineMovesTarget: dailyPipelineMoves
            )
            guard scopeIsCurrent, saved.projectId == projectId else {
                errorText = "Prosjektet ble endret før målet var ferdig lagret."
                return
            }
            onSaved()
            dismiss()
        } catch {
            guard !Task.isCancelled else { return }
            if scopeIsCurrent {
                errorText = "Kunne ikke lagre: \(error.localizedDescription)"
            }
        }
    }
}
