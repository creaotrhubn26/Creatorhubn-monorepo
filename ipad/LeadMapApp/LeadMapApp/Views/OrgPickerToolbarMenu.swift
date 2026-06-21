// OrgPickerToolbarMenu.swift
//
// Rask org-veksler øverst i hoved-toolbar — mountes i .topBarLeading på
// MyDayView (default-tab) + LeadgridHubView. Lar Daniel (eller andre med
// flere orgs) bytte aktiv org uten å gå via Super Admin → Org Switcher.
//
// Same mønster som AdminProductToolbarMenu (PR #829).

import SwiftUI

struct OrgPickerToolbarMenu: View {
    @Environment(AppState.self) private var appState

    var body: some View {
        // Vises hvis:
        //  - brukeren har 2+ orgs (kan veksle direkte), ELLER
        //  - brukeren er super_admin (kan se alle orgs i systemet via
        //    Org Switcher, selv om de bare har 1 medlemskap)
        if appState.organizations.count >= 2 || appState.isSuperAdmin {
            Menu {
                ForEach(appState.organizations, id: \.id) { org in
                    Button {
                        switchTo(org.id)
                    } label: {
                        HStack {
                            Text(org.name)
                            if appState.activeOrganizationId == org.id {
                                Spacer()
                                Image(systemName: "checkmark")
                            }
                        }
                    }
                }
                if appState.isSuperAdmin {
                    Divider()
                    // Hint til super_admin om at de kan se alle orgs (inkl.
                    // andre Leadgrid-kunder) via Org Switcher.
                    Label("Alle orgs er i Super Admin → Org Switcher",
                          systemImage: "shield.checkered")
                        .foregroundStyle(.secondary)
                }
            } label: {
                HStack(spacing: 4) {
                    Image(systemName: appState.isSuperAdmin
                          ? "shield.lefthalf.filled" : "building.2.fill")
                        .font(.caption)
                    Text(activeName)
                        .font(.caption.bold())
                        .lineLimit(1)
                        .truncationMode(.tail)
                    Image(systemName: "chevron.up.chevron.down")
                        .font(.caption2)
                }
                .padding(.horizontal, 10)
                .padding(.vertical, 5)
                .background(
                    (appState.isSuperAdmin ? Color.purple : Color.accentColor)
                        .opacity(0.15),
                    in: Capsule(),
                )
                .foregroundStyle(.primary)
            }
            .menuStyle(.borderlessButton)
        }
    }

    private var activeName: String {
        if let id = appState.activeOrganizationId,
           let org = appState.organizations.first(where: { $0.id == id }) {
            return org.name
        }
        return "Velg org"
    }

    private func switchTo(_ orgId: String) {
        guard orgId != appState.activeOrganizationId else { return }
        appState.activeOrganizationId = orgId
        // Last alt på nytt så Kart/Min dag/CRM viser den nye orgens data
        Task {
            await appState.loadOrgContext()
            await appState.refreshAll()
        }
    }
}
