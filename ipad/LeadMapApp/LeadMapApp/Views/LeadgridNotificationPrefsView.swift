// LeadgridNotificationPrefsView.swift
//
// Bruker velger hvordan + når de vil bli varslet om Leadgrid-events.

import SwiftUI

struct LeadgridNotificationPrefsView: View {
    let api: APIClient

    @State private var prefs: LeadgridNotificationPrefs = .defaults
    @State private var loading = true
    @State private var saving = false
    @State private var errorText: String?
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        NavigationStack {
            Form {
                if loading {
                    HStack { Spacer(); ProgressView(); Spacer() }
                } else {
                    Section("Hvor vil du bli varslet?") {
                        Toggle(isOn: $prefs.notifyInApp) {
                            Label("In-app (push i appen)", systemImage: "bell.badge.fill")
                        }
                        Toggle(isOn: $prefs.notifyEmail) {
                            Label("E-post", systemImage: "envelope.fill")
                        }
                        Toggle(isOn: $prefs.notifyWhatsapp) {
                            Label("WhatsApp", systemImage: "message.fill")
                        }
                    }

                    Section("Hvilke event-typer?") {
                        Toggle("Når jeg blir teamleder for en ny lead",
                               isOn: $prefs.notifyOnAssignedTeamLeader)
                        Toggle("Når jeg blir tildelt som rep",
                               isOn: $prefs.notifyOnAssignedAsRep)
                        Toggle("Status-endringer på leads jeg eier",
                               isOn: $prefs.notifyOnLeadStatusChange)
                        Toggle("Når en lead blir vunnet 🎉",
                               isOn: $prefs.notifyOnLeadWon)
                        Toggle("Når en lead blir tapt",
                               isOn: $prefs.notifyOnLeadLost)
                        Toggle("Når teammedlemmer åpner mine tildelte leads",
                               isOn: Binding(
                                get: { prefs.notifyOnAssignmentSeenStatus ?? false },
                                set: { prefs.notifyOnAssignmentSeenStatus = $0 }))
                    }

                    Section {
                        HStack {
                            TextField("Start (HH:MM)",
                                       text: Binding(
                                        get: { prefs.quietHoursStart ?? "" },
                                        set: { prefs.quietHoursStart = $0.isEmpty ? nil : $0 }))
                            Text("til")
                            TextField("Slutt (HH:MM)",
                                       text: Binding(
                                        get: { prefs.quietHoursEnd ?? "" },
                                        set: { prefs.quietHoursEnd = $0.isEmpty ? nil : $0 }))
                        }
                        Text("I stille-tider lagres in-app, men du får ikke e-post/WA.")
                            .font(.caption2)
                            .foregroundStyle(.secondary)
                    } header: { Text("Stille-tider (valgfri)") }
                }
                if let errorText {
                    Section { Text(errorText).foregroundStyle(.red) }
                }
            }
            .navigationTitle("Varsels-innstillinger")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Avbryt") { dismiss() }
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Lagre") {
                        Task { await save() }
                    }
                    .disabled(saving || loading)
                    .bold()
                }
            }
            .task { await load() }
        }
    }

    private func load() async {
        do {
            let res = try await api.fetchMyLeadgridNotificationPrefs()
            await MainActor.run {
                prefs = res
                loading = false
            }
        } catch {
            await MainActor.run {
                errorText = "Kunne ikke laste innstillinger: \(error.localizedDescription)"
                loading = false
            }
        }
    }

    private func save() async {
        saving = true
        defer { saving = false }
        do {
            let body: [String: Any] = [
                "notify_email": prefs.notifyEmail,
                "notify_whatsapp": prefs.notifyWhatsapp,
                "notify_sms": prefs.notifySms,
                "notify_in_app": prefs.notifyInApp,
                "notify_on_assigned_team_leader": prefs.notifyOnAssignedTeamLeader,
                "notify_on_assigned_as_rep": prefs.notifyOnAssignedAsRep,
                "notify_on_lead_status_change": prefs.notifyOnLeadStatusChange,
                "notify_on_lead_won": prefs.notifyOnLeadWon,
                "notify_on_lead_lost": prefs.notifyOnLeadLost,
                "notify_on_assignment_seen_status": prefs.notifyOnAssignmentSeenStatus ?? false,
                "quiet_hours_start": prefs.quietHoursStart as Any,
                "quiet_hours_end": prefs.quietHoursEnd as Any,
            ]
            try await api.updateMyLeadgridNotificationPrefs(body)
            await MainActor.run { dismiss() }
        } catch {
            await MainActor.run {
                errorText = "Lagring feilet: \(error.localizedDescription)"
            }
        }
    }
}
