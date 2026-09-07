import SwiftUI

/// Workspace-administrasjon som tidligere var spredt i Verktøy. Personlige
/// varselvalg er tilgjengelige for alle. Kanal/partner er admin-avgrenset,
/// mens rapportplaner kan styres av owner, admin, markedssjef og salgssjef.
struct WorkspaceSettingsSheet: View {
    @Environment(AppState.self) private var appState
    @Environment(\.dismiss) private var dismiss

    @State private var showNotificationPrefs = false
    @State private var showChannelSetup = false
    @State private var showScheduledReports = false
    @State private var showPartners = false
    @State private var partnerProgramActive = false

    private var availabilityLoadKey: String {
        "\(appState.activeOrganizationId ?? "none")|\(appState.canManageWorkspaceBilling)"
    }

    var body: some View {
        NavigationStack {
            List {
                Section("Varsler") {
                    settingsButton(
                        title: "Varselinnstillinger",
                        subtitle: "Velg hendelser, kanaler og stille tider",
                        icon: "bell.badge.fill"
                    ) { showNotificationPrefs = true }
                }

                Section("Workspace-kanaler") {
                    if appState.canManageWorkspaceBilling {
                        settingsButton(
                            title: "Kanaloppsett",
                            subtitle: "Konfigurer e-post og WhatsApp for workspacet",
                            icon: "checkmark.shield.fill"
                        ) { showChannelSetup = true }
                    } else {
                        Label(
                            "Kanaloppsett administreres av workspace-administrator",
                            systemImage: "lock.shield.fill"
                        )
                        .foregroundStyle(.secondary)
                    }
                }

                Section("Rapporter") {
                    if appState.canManageWorkspaceReports {
                        settingsButton(
                            title: "Schedulerte rapporter",
                            subtitle: "Administrer tidsplan, mottakere og rapportformat",
                            icon: "calendar.badge.clock"
                        ) { showScheduledReports = true }
                    } else {
                        Label(
                            "Rapportplaner administreres av workspace- eller salgsledelsen",
                            systemImage: "lock.shield.fill"
                        )
                        .foregroundStyle(.secondary)
                    }
                }

                if appState.canManageWorkspaceBilling, partnerProgramActive {
                    Section("Administrator") {
                        settingsButton(
                            title: "Partnerprogram",
                            subtitle: "Se aktive Leadgrid-partnere",
                            icon: "person.2.circle.fill"
                        ) { showPartners = true }
                    }
                }
            }
            .navigationTitle("Workspace-innstillinger")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button("Ferdig") { dismiss() }
                }
            }
            .marketingDirectorBackdrop(.notifications)
        }
        .preferredColorScheme(.dark)
        .presentationDragIndicator(.visible)
        .sheet(isPresented: $showNotificationPrefs) {
            if let api = appState.api {
                LeadgridNotificationPrefsView(api: api)
            }
        }
        .sheet(isPresented: $showChannelSetup) {
            if let api = appState.api, appState.canManageWorkspaceBilling {
                LeadgridChannelOnboardingWizardView(api: api)
            }
        }
        .sheet(isPresented: $showScheduledReports) {
            if let api = appState.api,
               let organizationId = appState.activeOrganizationId,
               appState.canManageWorkspaceReports {
                NavigationStack {
                    LeadgridScheduledReportsView(
                        api: api,
                        organizationId: organizationId
                    )
                }
            }
        }
        .sheet(isPresented: $showPartners) {
            if let api = appState.api,
               appState.canManageWorkspaceBilling,
               partnerProgramActive {
                NavigationStack { LeadgridPartnersView(api: api) }
            }
        }
        .task(id: availabilityLoadKey) { await loadPartnerAvailability() }
    }

    private func settingsButton(
        title: String,
        subtitle: String,
        icon: String,
        action: @escaping () -> Void
    ) -> some View {
        Button(action: action) {
            HStack(spacing: 12) {
                Image(systemName: icon)
                    .foregroundStyle(LBrand.purpleLight)
                    .frame(width: 26)
                VStack(alignment: .leading, spacing: 2) {
                    Text(title).foregroundStyle(.primary)
                    Text(subtitle)
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }
                Spacer()
                Image(systemName: "chevron.right")
                    .font(.caption.bold())
                    .foregroundStyle(.tertiary)
            }
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
    }

    @MainActor
    private func loadPartnerAvailability() async {
        partnerProgramActive = false
        guard appState.canManageWorkspaceBilling, let api = appState.api else { return }
        do {
            let response = try await api.fetchLeadgridPartners()
            partnerProgramActive = !response.partners.isEmpty
        } catch {
            // Fail closed: partnerprogrammet vises aldri på nettverksfeil eller
            // når backend ikke har publisert minst én aktiv partner.
            partnerProgramActive = false
        }
    }
}
