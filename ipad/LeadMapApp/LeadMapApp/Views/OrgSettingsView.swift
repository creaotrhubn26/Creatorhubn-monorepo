// OrgSettingsView.swift
//
// Org-velger + posisjons-deling-toggle + medlemsliste m/ online-status.
// Speilet fra web LeadMapOrgPanel (PR #611+#612).

import SwiftUI

struct OrgSettingsView: View {
    @Environment(AppState.self) private var state
    @State private var members: [MemberProfile] = []
    @State private var teams: [SalesTeam] = []
    @State private var profileEnvelope: OrgProfileEnvelope?
    @State private var isLoading = false

    var body: some View {
        NavigationStack {
            Form {
                if !state.organizations.isEmpty {
                    orgPickerSection
                }
                if let profile = profileEnvelope?.profile {
                    orgProfileSection(profile)
                }
                consentSection
                if !teams.isEmpty {
                    teamsSection
                }
                membersSection
                roleSection
                signOutSection
            }
            .navigationTitle("Organisasjon")
            .task { await load() }
            .refreshable { await load() }
        }
    }

    // MARK: - Org-velger

    @ViewBuilder
    private var orgPickerSection: some View {
        Section("Organisasjon") {
            Picker("Aktiv org", selection: Binding(
                get: { state.activeOrganizationId ?? "" },
                set: { newValue in
                    var s = state
                    s.activeOrganizationId = newValue.isEmpty ? nil : newValue
                }
            )) {
                ForEach(state.organizations) { org in
                    HStack {
                        Text(org.name)
                        if org.isDeveloperOrg {
                            Text("Utvikler")
                                .font(.caption2).bold()
                                .padding(.horizontal, 4).padding(.vertical, 1)
                                .background(Color.purple.opacity(0.2), in: Capsule())
                                .foregroundStyle(.purple)
                        }
                    }
                    .tag(org.id)
                }
            }
        }
    }

    // MARK: - Org-profil

    private func orgProfileSection(_ profile: OrganizationProfile) -> some View {
        Section("Profil") {
            HStack(spacing: 12) {
                AsyncImage(url: profile.logoUrl.flatMap(URL.init)) { phase in
                    switch phase {
                    case .success(let img): img.resizable().scaledToFit()
                    default: Image(systemName: "building.2.fill").foregroundStyle(.secondary)
                    }
                }
                .frame(width: 56, height: 56)
                .background(Color.white)
                .clipShape(RoundedRectangle(cornerRadius: 8))
                VStack(alignment: .leading, spacing: 2) {
                    Text(profile.name).font(.headline)
                    if let orgNr = profile.orgNumber {
                        Text("Org.nr \(orgNr)").font(.caption).foregroundStyle(.secondary)
                    }
                    if let website = profile.website {
                        Text(website).font(.caption).foregroundStyle(.secondary)
                    }
                }
                Spacer()
            }
            if let desc = profile.description, !desc.isEmpty {
                Text(desc).font(.callout).foregroundStyle(.secondary)
            }
        }
    }

    // MARK: - Posisjons-deling

    private var consentSection: some View {
        Section {
            Toggle(isOn: Binding(
                get: { state.locationConsentGranted },
                set: { newValue in
                    Task { await state.setLocationConsent(newValue) }
                }
            )) {
                VStack(alignment: .leading) {
                    Text("Del min posisjon")
                    Text(state.locationConsentGranted
                         ? "Du vises som live pin på org-kartet"
                         : "Kun valgfritt — av som standard")
                        .font(.caption).foregroundStyle(.secondary)
                }
            }
        } header: {
            Text("Personvern")
        } footer: {
            Text("Posisjon brukes til å vise live selger-pins på Lead Map for hele org-en. Du kan skru av når som helst.")
        }
    }

    // MARK: - Teams

    private var teamsSection: some View {
        Section("Salgs-team (\(teams.count))") {
            ForEach(teams) { team in
                VStack(alignment: .leading, spacing: 2) {
                    Text(team.name).font(.headline)
                    HStack(spacing: 8) {
                        if let t = team.territory {
                            Label(t, systemImage: "map").font(.caption2).foregroundStyle(.secondary)
                        }
                        Label("\(team.memberCount) medlemmer", systemImage: "person.3")
                            .font(.caption2).foregroundStyle(.secondary)
                    }
                    if let lead = team.teamLeadName {
                        Text("Teamleder: \(lead)").font(.caption).foregroundStyle(.secondary)
                    }
                }
            }
        }
    }

    // MARK: - Medlemmer

    private var membersSection: some View {
        Section("Medlemmer (\(members.count))") {
            ForEach(members) { m in
                HStack(spacing: 10) {
                    ZStack(alignment: .bottomTrailing) {
                        AsyncImage(url: m.avatarUrl.flatMap(URL.init)) { phase in
                            switch phase {
                            case .success(let img): img.resizable().scaledToFit()
                            default:
                                Text(String((m.displayName ?? m.userEmail ?? "?").prefix(1)))
                                    .font(.caption).bold()
                                    .foregroundStyle(.white)
                                    .frame(maxWidth: .infinity, maxHeight: .infinity)
                                    .background(Color.gray)
                            }
                        }
                        .frame(width: 32, height: 32)
                        .clipShape(Circle())
                        if m.isOnline == true {
                            Circle()
                                .fill(Color(red: 0.2, green: 0.85, blue: 0.6))
                                .frame(width: 8, height: 8)
                                .overlay(Circle().stroke(Color(.systemBackground), lineWidth: 1.5))
                        }
                    }
                    VStack(alignment: .leading) {
                        Text(m.displayName ?? m.userName ?? m.userEmail ?? m.userId)
                            .font(.callout)
                        HStack(spacing: 6) {
                            Text(roleLabel(m.role))
                                .font(.caption2).bold()
                                .padding(.horizontal, 4).padding(.vertical, 1)
                                .background(roleColor(m.role).opacity(0.2), in: Capsule())
                                .foregroundStyle(roleColor(m.role))
                            if let title = m.title {
                                Text(title).font(.caption).foregroundStyle(.secondary)
                            }
                        }
                    }
                    Spacer()
                }
            }
            if members.isEmpty && !isLoading {
                Text("Ingen medlemmer enda").foregroundStyle(.secondary)
            }
        }
    }

    // MARK: - Min rolle + permissions

    private var roleSection: some View {
        Section("Min rolle") {
            HStack {
                Text("Rolle")
                Spacer()
                Text(roleLabel(state.roleInOrg ?? "—"))
                    .foregroundStyle(roleColor(state.roleInOrg ?? ""))
            }
            HStack {
                Text("Tillatelser")
                Spacer()
                Text("\(state.permissions.count) aktive")
                    .foregroundStyle(.secondary)
            }
        }
    }

    private var signOutSection: some View {
        Section {
            Button("Logg ut", role: .destructive) {
                state.signOut()
            }
        }
    }

    @MainActor
    private func load() async {
        isLoading = true
        defer { isLoading = false }
        guard let api = state.api else { return }
        await state.loadOrgContext()
        guard let orgId = state.activeOrganizationId else { return }
        do {
            self.profileEnvelope = try await api.fetchOrgProfile(orgId)
        } catch {
            print("[OrgSettings] profile failed: \(error)")
        }
        do {
            self.members = try await api.fetchOrgMembers(orgId)
        } catch {
            print("[OrgSettings] members failed: \(error)")
        }
        do {
            self.teams = try await api.fetchSalesTeams(orgId)
        } catch {
            print("[OrgSettings] teams failed: \(error)")
        }
    }
}

// MARK: - Rolle-helpers

private func roleLabel(_ key: String) -> String {
    switch key {
    case "admin": return "Administrator"
    case "salgssjef": return "Salgssjef"
    case "teamleder": return "Teamleder"
    case "salgskonsulent": return "Salgskonsulent"
    case "promotor": return "Promotør"
    case "member": return "Medlem"
    case "viewer": return "Leser"
    default: return key
    }
}

private func roleColor(_ key: String) -> Color {
    switch key {
    case "admin": return .purple
    case "salgssjef": return .orange
    case "teamleder": return .yellow
    case "salgskonsulent": return .green
    case "promotor": return .blue
    case "viewer": return .gray
    default: return .gray
    }
}
