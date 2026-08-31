// ProjectContextPill.swift — «hvilket prosjekt jobber jeg på?» (2026-08-02)
//
// Tydelig prosjekt-kontekst i fane-headeren: pill viser aktivt prosjekt
// (lilla-markert) eller «Alle prosjekter», og er samtidig switcher —
// tap → meny med alle prosjekter + lead-antall. Bytte setter
// appState.activeProjectId → didSet henter leads på nytt, så KPI-er,
// kart og lister på fanen re-filtreres automatisk.
//
// Erstatter den gamle umonterte ProjectPicker (confirmationDialog) —
// Menu er riktig idiom i den nye delte headeren (samme stil som
// områder-menyen). Skjules for rene dørsalg-org-er (leads låst i
// profilen → prosjektvalg er meningsløst) og når org-en ikke har
// noen prosjekter.

import SwiftUI

struct ProjectContextPill: View {
    @Environment(AppState.self) private var appState

    // Samme verdier som Brand i LeadgridTabHeader (file-private der).
    private static let card = Color(red: 0.10, green: 0.09, blue: 0.16)
    private static let stroke = Color.white.opacity(0.06)
    private static let purple = Color(red: 0.66, green: 0.32, blue: 0.99)
    private static let purpleLight = Color(red: 0.75, green: 0.45, blue: 1.0)
    private static let textSecondary = Color.white.opacity(0.62)

    private var activeProject: ProjectListItem? {
        guard let id = appState.activeProjectId else { return nil }
        return appState.projects.first(where: { $0.id == id })
    }

    private var currentLabel: String {
        activeProject?.name
            ?? appState.activeProjectSummary?.project.name
            ?? "Alle prosjekter"
    }

    private var hasActiveProject: Bool {
        appState.activeProjectId != nil
    }

    @State private var nyttProsjektAapen = false
    @State private var nyttProsjektNavn = ""

    var body: some View {
        // Vis også når lista er TOM: Leadgrid oppretter nå egne prosjekter
        // (før var man avhengig av Role Room for å ha noen i det hele tatt).
        if !EntitlementStore.shared.erRenDorsalgOrg {
            Menu {
                Button {
                    appState.activeProjectId = nil
                } label: {
                    if hasActiveProject {
                        Text("Alle prosjekter")
                    } else {
                        Label("Alle prosjekter", systemImage: "checkmark")
                    }
                }
                Divider()
                ForEach(appState.projects) { project in
                    Button {
                        appState.activeProjectId = project.id
                    } label: {
                        if project.id == appState.activeProjectId {
                            Label(menuTitle(for: project), systemImage: "checkmark")
                        } else {
                            Text(menuTitle(for: project))
                        }
                    }
                }
                Divider()
                Button {
                    nyttProsjektNavn = ""
                    nyttProsjektAapen = true
                } label: {
                    Label("Nytt prosjekt …", systemImage: "folder.badge.plus")
                }
            } label: {
                pill
            }
            .alert("Nytt prosjekt", isPresented: $nyttProsjektAapen) {
                TextField("Prosjektnavn", text: $nyttProsjektNavn)
                Button("Opprett") {
                    let navn = nyttProsjektNavn.trimmingCharacters(in: .whitespaces)
                    guard navn.count >= 2, let api = appState.api,
                          let organizationId = appState.activeOrganizationId else { return }
                    Task { @MainActor in
                        if let prosjekt = try? await api.createLeadMapProject(
                            name: navn, organizationId: organizationId) {
                            appState.projects.insert(prosjekt, at: 0)
                            appState.activeProjectId = prosjekt.id
                        }
                    }
                }
                Button("Avbryt", role: .cancel) {}
            } message: {
                Text("Prosjektet grupperer leads, brand-kit og markedsscan — helt uavhengig av The Role Room.")
            }
            .menuStyle(.borderlessButton)
            .fixedSize()
            .accessibilityIdentifier("header-project-pill")
            .accessibilityLabel("Aktivt prosjekt: \(currentLabel)")
            .macCatalystHover()
        }
    }

    private func menuTitle(for project: ProjectListItem) -> String {
        project.leadCount > 0 ? "\(project.name) (\(project.leadCount))" : project.name
    }

    /// Samme form som headerens pickerButton, men lilla-fylt når et
    /// prosjekt er aktivt — konteksten skal synes, ikke gjettes.
    private var pill: some View {
        HStack(spacing: 10) {
            Image(systemName: hasActiveProject ? "folder.fill" : "folder")
                .font(.appScaled(size: 14, weight: .semibold))
                .foregroundStyle(hasActiveProject ? .white : Self.purpleLight)
            Text(currentLabel)
                .font(.appScaled(size: 13, weight: .semibold))
                .foregroundStyle(.white)
                .lineLimit(1)
                .fixedSize(horizontal: true, vertical: false)
            Image(systemName: "chevron.down")
                .font(.appScaled(size: 10, weight: .semibold))
                .foregroundStyle(hasActiveProject ? Color.white.opacity(0.75) : Self.textSecondary)
        }
        .padding(.horizontal, 12).padding(.vertical, 10)
        .background(
            hasActiveProject ? Self.purple.opacity(0.85) : Self.card,
            in: RoundedRectangle(cornerRadius: 12)
        )
        .overlay(RoundedRectangle(cornerRadius: 12).stroke(
            hasActiveProject ? Self.purpleLight.opacity(0.6) : Self.stroke, lineWidth: 1))
    }
}
