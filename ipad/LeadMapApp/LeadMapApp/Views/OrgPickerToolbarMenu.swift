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
        // Bare vis hvis brukeren har 2+ orgs. Med 1 org gir veksler ingen
        // verdi og tar bare plass i toolbar.
        if appState.organizations.count >= 2 {
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
            } label: {
                HStack(spacing: 4) {
                    Image(systemName: "building.2.fill")
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
                .background(Color.accentColor.opacity(0.15), in: Capsule())
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
