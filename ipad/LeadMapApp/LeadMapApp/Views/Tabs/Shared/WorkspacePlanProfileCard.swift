import SwiftUI

/// Workspace-scopet abonnement i Profil. Komponenten viser plan til alle
/// medlemmer, men tilbyr faktura-/betalingshandlinger kun til org-admin.
struct WorkspacePlanProfileCard: View {
    @Environment(AppState.self) private var appState
    @State private var showSubscription = false
    @State private var showWorkspaceSettings = false

    private var activeOrganizationName: String {
        appState.organizations.first(where: { $0.id == appState.activeOrganizationId })?.name
            ?? "Aktivt workspace"
    }

    private var roleDisplayName: String {
        switch appState.roleInOrg {
        case "admin": return "Administrator"
        case "salgssjef": return "Salgssjef"
        case "teamleder": return "Teamleder"
        case "salgskonsulent": return "Salgskonsulent"
        case "kvalitet": return "Kvalitetskontrollør"
        case "promotor": return "Promotør"
        case .some(let role): return role.capitalized
        case nil: return "Medlem"
        }
    }

    private var summary: LeadgridPlanSummary? {
        guard appState.workspacePlanOrganizationId == appState.activeOrganizationId else { return nil }
        return appState.workspacePlanSummary
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 13) {
            HStack(spacing: 11) {
                ZStack {
                    RoundedRectangle(cornerRadius: 11)
                        .fill(LBrand.purple.opacity(0.22))
                    Image(systemName: LeadgridPlanPresentation.icon(for: summary?.planKey))
                        .font(.appScaled(size: 15, weight: .bold))
                        .foregroundStyle(LBrand.purpleLight)
                }
                .frame(width: 40, height: 40)

                VStack(alignment: .leading, spacing: 2) {
                    Text("WORKSPACE OG ABONNEMENT")
                        .font(.appScaled(size: 10, weight: .black))
                        .foregroundStyle(LBrand.textTertiary)
                        .tracking(0.7)
                    Text(activeOrganizationName)
                        .font(.appScaled(size: 15, weight: .bold))
                        .foregroundStyle(.white)
                        .lineLimit(1)
                }
                Spacer()
                if let summary, summary.inGrace {
                    Text("GRACE")
                        .font(.appScaled(size: 9, weight: .black))
                        .foregroundStyle(LBrand.orange)
                        .padding(.horizontal, 7)
                        .padding(.vertical, 4)
                        .background(LBrand.orange.opacity(0.16), in: Capsule())
                }
            }

            Divider().overlay(LBrand.stroke)
            detailRow(label: "Rolle", value: roleDisplayName)
            planRow

            if let summary {
                VStack(alignment: .leading, spacing: 6) {
                    HStack {
                        Text(summary.primaryLabel)
                        Spacer()
                        Text("\(summary.worstPct)%")
                    }
                    .font(.appScaled(size: 10, weight: .semibold))
                    .foregroundStyle(LBrand.textSecondary)
                    ProgressView(value: Double(min(summary.worstPct, 100)), total: 100)
                        .tint(planTint(summary.worstPct))
                }
            }

            Button {
                showSubscription = true
            } label: {
                HStack(spacing: 7) {
                    Image(systemName: appState.canManageWorkspaceBilling
                          ? "creditcard.fill" : "list.bullet.rectangle.fill")
                    Text(appState.canManageWorkspaceBilling
                         ? "Administrer abonnement" : "Se plan og funksjoner")
                    Spacer()
                    Image(systemName: "chevron.right")
                }
                .font(.appScaled(size: 12, weight: .bold))
                .foregroundStyle(.white)
                .padding(.horizontal, 12)
                .padding(.vertical, 11)
                .background(LBrand.purple.opacity(0.24), in: RoundedRectangle(cornerRadius: 10))
            }
            .buttonStyle(.plain)
            .disabled(appState.activeOrganizationId == nil)

            Button { showWorkspaceSettings = true } label: {
                HStack(spacing: 7) {
                    Image(systemName: "gearshape.2.fill")
                    Text("Workspace-innstillinger")
                    Spacer()
                    Image(systemName: "chevron.right")
                }
                .font(.appScaled(size: 12, weight: .bold))
                .foregroundStyle(.white)
                .padding(.horizontal, 12)
                .padding(.vertical, 11)
                .background(LBrand.cardHi, in: RoundedRectangle(cornerRadius: 10))
                .overlay(RoundedRectangle(cornerRadius: 10)
                    .stroke(LBrand.stroke, lineWidth: 1))
            }
            .buttonStyle(.plain)
            .disabled(appState.api == nil)
        }
        .padding(14)
        .background(LBrand.card, in: RoundedRectangle(cornerRadius: 12))
        .overlay(RoundedRectangle(cornerRadius: 12).stroke(LBrand.stroke, lineWidth: 1))
        .task(id: appState.activeOrganizationId) {
            guard summary == nil,
                  appState.workspacePlanLoadState != .loading else { return }
            await appState.loadWorkspacePlanSummary()
        }
        .sheet(isPresented: $showSubscription) {
            AbonnementSheet()
        }
        .sheet(isPresented: $showWorkspaceSettings) {
            WorkspaceSettingsSheet()
        }
    }

    @ViewBuilder
    private var planRow: some View {
        switch appState.workspacePlanLoadState {
        case .idle, .loading:
            HStack(spacing: 8) {
                ProgressView().tint(LBrand.purpleLight)
                Text("Henter abonnement …")
                    .font(.appScaled(size: 12, weight: .semibold))
                    .foregroundStyle(LBrand.textSecondary)
            }
        case .loaded:
            detailRow(label: "Abonnement",
                      value: summary?.displayName ?? "Ingen aktiv plan")
        case .failed:
            HStack {
                detailRow(label: "Abonnement", value: "Kunne ikke hentes")
                Button("Prøv igjen") {
                    Task { await appState.loadWorkspacePlanSummary() }
                }
                .font(.appScaled(size: 10, weight: .bold))
                .foregroundStyle(LBrand.purpleLight)
            }
        }
    }

    private func detailRow(label: String, value: String) -> some View {
        HStack {
            Text(label)
                .font(.appScaled(size: 11))
                .foregroundStyle(LBrand.textSecondary)
            Spacer()
            Text(value)
                .font(.appScaled(size: 12, weight: .bold))
                .foregroundStyle(.white)
                .multilineTextAlignment(.trailing)
        }
    }

    private func planTint(_ percent: Int) -> Color {
        if percent >= 90 { return LBrand.red }
        if percent >= 75 { return LBrand.orange }
        return LBrand.green
    }
}
