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

    @State private var projectOnboardingOpen = false
    @State private var pendingOnboardingResult: LeadgridProjectOnboardingResult?
    #if DEBUG
    @State private var didAutoOpenProjectOnboarding = false
    #endif

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
                if appState.isSuperAdmin
                    || (appState.can("projects.create") && appState.can("lead_research.run")) {
                    Button {
                        projectOnboardingOpen = true
                    } label: {
                        Label("Nytt prosjekt fra domene …", systemImage: "sparkles.rectangle.stack")
                    }
                    .accessibilityIdentifier("project-onboarding.open")
                }
            } label: {
                pill
            }
            .sheet(isPresented: $projectOnboardingOpen, onDismiss: activateOnboardedProject) {
                if let api = appState.api,
                   let organizationId = appState.activeOrganizationId {
                    ProjectDomainOnboardingView(
                        api: api,
                        organizationId: organizationId,
                        organizations: appState.organizations,
                        defaultAdministratorEmail: appState.userEmail ?? "",
                        onCompleted: { result in
                            pendingOnboardingResult = result
                        }
                    )
                } else {
                    ContentUnavailableView(
                        "Velg organisasjon",
                        systemImage: "building.2.crop.circle",
                        description: Text("En aktiv organisasjon kreves før kundeprosjektet kan opprettes.")
                    )
                }
            }
            .menuStyle(.borderlessButton)
            .fixedSize()
            .accessibilityIdentifier("header-project-pill")
            .accessibilityLabel("Aktivt prosjekt: \(currentLabel)")
            .onAppear {
                #if DEBUG
                if ProcessInfo.processInfo.environment["QA_TOUR"] == "domain-onboarding",
                   !didAutoOpenProjectOnboarding {
                    didAutoOpenProjectOnboarding = true
                    projectOnboardingOpen = true
                }
                #endif
            }
            .macCatalystHover()
        }
    }

    @MainActor
    private func activateOnboardedProject() {
        guard let result = pendingOnboardingResult else { return }
        pendingOnboardingResult = nil
        if appState.activeOrganizationId != result.project.organizationId {
            appState.activeOrganizationId = result.project.organizationId
        }
        // Commit-responsen er en autoritativ serververifikasjon av både
        // organisasjons- og prosjekt-ACL. Behold fail-closed som standard,
        // men la denne bekreftede overgangen åpne Discovery umiddelbart mens
        // org-entitlements lastes på nytt i bakgrunnen.
        if result.access?.discoveryAccessVerified == true {
            appState.leadgridDiscoveryEnabled = true
        }
        if !appState.organizations.contains(where: { $0.id == result.project.organizationId }),
           let access = result.access {
            appState.organizations.append(.init(
                id: access.organization.id,
                name: access.organization.name,
                slug: nil,
                plan: "free",
                orgType: "customer",
                logoUrl: nil,
                role: "member",
                memberCount: 1 + access.invitations.count,
                projectCount: 1
            ))
        }
        if let index = appState.projects.firstIndex(where: { $0.id == result.project.id }) {
            appState.projects[index] = result.project
        } else {
            appState.projects.insert(result.project, at: 0)
        }
        appState.activeProjectId = result.project.id
        Task { @MainActor in
            // Vent til onboarding-arket er helt lukket før fullskjerms-Discovery
            // presenteres. Da unngår vi konkurrerende SwiftUI-presentasjoner.
            await Task.yield()
            await appState.configureDiscovery()
            appState.discoveryCoordinator.applyCommittedProfiles(
                result.profiles,
                forProjectId: result.project.id
            )
            appState.discoveryCoordinator.showWorkspace()
        }
    }

    private func menuTitle(for project: ProjectListItem) -> String {
        project.leadCount > 0 ? "\(project.name) (\(project.leadCount))" : project.name
    }

    /// Samme form som headerens pickerButton, men lilla-fylt når et
    /// prosjekt er aktivt — konteksten skal synes, ikke gjettes.
    private var pill: some View {
        HStack(spacing: DeviceIdiom.isPhone ? 6 : 10) {
            Image(systemName: hasActiveProject ? "folder.fill" : "folder")
                .font(.system(size: 14, weight: .semibold))
                .foregroundStyle(hasActiveProject ? .white : Self.purpleLight)
            Text(currentLabel)
                .font(.system(size: 13, weight: .semibold))
                .foregroundStyle(.white)
                .lineLimit(1)
                .frame(maxWidth: DeviceIdiom.isPhone ? 150 : nil)
            if !DeviceIdiom.isPhone {
                Image(systemName: "chevron.down")
                    .font(.system(size: 10, weight: .semibold))
                    .foregroundStyle(hasActiveProject ? Color.white.opacity(0.75) : Self.textSecondary)
            }
        }
        .padding(.horizontal, DeviceIdiom.isPhone ? 8 : 12)
        .padding(.vertical, 10)
        .background(
            hasActiveProject ? Self.purple.opacity(0.85) : Self.card,
            in: RoundedRectangle(cornerRadius: 12)
        )
        .overlay(RoundedRectangle(cornerRadius: 12).stroke(
            hasActiveProject ? Self.purpleLight.opacity(0.6) : Self.stroke, lineWidth: 1))
    }
}
