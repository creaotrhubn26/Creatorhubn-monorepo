import SwiftUI

struct ProjectDomainOnboardingView: View {
    let api: APIClient
    let organizationId: String
    let organizations: [OrganizationSummary]
    let defaultAdministratorEmail: String
    let onCompleted: (LeadgridProjectOnboardingResult) -> Void

    @Environment(\.dismiss) private var dismiss
    @State private var website = ""
    @State private var preview: LeadgridProjectOnboardingPreview?
    @State private var profiles: [DiscoveryV2ProfileWrite] = []
    @State private var isAnalyzing = false
    @State private var isSaving = false
    @State private var errorMessage: String?
    @State private var organizationChoice = "create"
    @State private var companyName = ""
    @State private var administratorEmail = ""
    @State private var teamChoice = "create"
    @State private var teamName = ""
    @State private var existingTeamId = ""
    @State private var invitations: [LeadgridProjectOnboardingInvitationWrite] = []
    @State private var completionResult: LeadgridProjectOnboardingResult?
    @State private var organizationOptions: [LeadgridProjectOnboardingAccessOptions.Organization] = []
    @State private var availableTeams: [LeadgridProjectOnboardingAccessOptions.Team] = []

    private var trimmedWebsite: String {
        website.trimmingCharacters(in: .whitespacesAndNewlines)
    }

    private var websiteError: String? {
        if trimmedWebsite.isEmpty { return "Skriv inn kundens domene." }
        if trimmedWebsite.count > 2_048 { return "Nettadressen er for lang." }
        let withoutScheme = trimmedWebsite
            .replacingOccurrences(of: #"^https?://"#, with: "", options: .regularExpression)
        if !withoutScheme.contains(".") { return "Skriv inn et domene, for eksempel dentum.no." }
        return nil
    }

    private var profileError: String? {
        guard !profiles.isEmpty else { return "Minst én Discovery-profil kreves." }
        let normalizedNames = profiles.map {
            $0.name.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
        }
        if normalizedNames.contains("") { return "Alle profiler må ha et navn." }
        if Set(normalizedNames).count != normalizedNames.count {
            return "Profilene må ha unike navn."
        }
        return profiles.compactMap { $0.brief.validationMessage }.first
    }

    private var accessError: String? {
        guard preview?.canManageMultipleProfiles == true else { return nil }
        if organizationChoice == "create" && companyName.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
            return "Selskapsnavn må fylles ut."
        }
        if organizationChoice != "create" && !organizationOptions.contains(where: { $0.id == organizationChoice }) {
            return "Velg en gyldig kundeorganisasjon."
        }
        if !Self.isValidEmail(administratorEmail) {
            return "Kundeadmin må ha en gyldig e-postadresse."
        }
        if teamChoice == "create" && teamName.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
            return "Teamnavn må fylles ut."
        }
        if teamChoice == "existing" && existingTeamId.isEmpty {
            return "Velg et eksisterende salgsteam."
        }
        let emails = [administratorEmail] + invitations.map(\.email)
        if emails.contains(where: { !Self.isValidEmail($0) }) {
            return "Alle inviterte må ha en gyldig e-postadresse."
        }
        if Set(emails.map { $0.lowercased() }).count != emails.count {
            return "Samme e-postadresse kan bare legges til én gang."
        }
        return nil
    }

    var body: some View {
        NavigationStack {
            Form {
                Section {
                    TextField("dentum.no", text: $website)
                        .textContentType(.URL)
                        .textInputAutocapitalization(.never)
                        .keyboardType(.URL)
                        .autocorrectionDisabled()
                        .disabled(isAnalyzing || isSaving)
                        .accessibilityIdentifier("project-onboarding.domain")

                    if preview == nil {
                        Button {
                            Task { await analyze() }
                        } label: {
                            Label(
                                isAnalyzing ? "Analyserer nettsted …" : "Analyser nettsted",
                                systemImage: "sparkles.magnifyingglass"
                            )
                        }
                        .disabled(websiteError != nil || isAnalyzing)
                        .accessibilityIdentifier("project-onboarding.analyze")
                    } else {
                        Button("Analyser på nytt") {
                            Task { await analyze() }
                        }
                        .disabled(websiteError != nil || isAnalyzing || isSaving)
                    }
                } header: {
                    Text("Kundens nettsted")
                } footer: {
                    Text("Leadgrid analyserer offentlig nettstedinnhold. Ingen prosjektdata eller leads lagres før du bekrefter.")
                }

                if let preview {
                    Section("Foreslått prosjekt") {
                        LabeledContent("Navn", value: preview.projectName)
                            .accessibilityIdentifier("project-onboarding.project-name")
                        LabeledContent("Kategori", value: preview.category)
                            .accessibilityIdentifier("project-onboarding.category")
                        LabeledContent("Domene", value: preview.websiteDomain)
                        if !preview.projectDescription.isEmpty {
                            Text(preview.projectDescription)
                                .font(.callout)
                                .foregroundStyle(.secondary)
                        }
                        ForEach(preview.classificationReasons, id: \.self) { reason in
                            Label(reason, systemImage: "checkmark.seal")
                                .font(.caption)
                                .foregroundStyle(.secondary)
                        }
                    }

                    if preview.canManageMultipleProfiles {
                        accessSetupSection
                    }

                    Section {
                        ForEach(profiles.indices, id: \.self) { index in
                            OnboardingDiscoveryProfileEditor(
                                profile: $profiles[index],
                                profileIndex: index,
                                canEdit: preview.canManageMultipleProfiles,
                                canDelete: preview.canManageMultipleProfiles && profiles.count > 1,
                                onDelete: { profiles.remove(at: index) }
                            )
                        }

                        if preview.canManageMultipleProfiles && profiles.count < 10 {
                            Button {
                                addProfile()
                            } label: {
                                Label(
                                    "Legg til Discovery-profil (\(profiles.count) av 10)",
                                    systemImage: "plus.rectangle.on.rectangle"
                                )
                            }
                            .accessibilityIdentifier("project-onboarding.profile.add")
                            .accessibilityValue("\(profiles.count) av 10 profiler")
                        }
                    } header: {
                        Text("Discovery-profiler")
                    } footer: {
                        if preview.canManageMultipleProfiles {
                            Text("Som Super Admin kan du endre forslaget eller opprette opptil ti profiler. Kartområder og kommuner kan finjusteres videre i Discovery.")
                        } else {
                            Text("Profilen kan finjusteres i Discovery før første kjøring.")
                        }
                    }

                    Section("Leadgrid-skills") {
                        ForEach(preview.skills) { skill in
                            HStack(spacing: 12) {
                                Image(systemName: skill.state == .ready ? "checkmark.circle.fill" : "clock.badge.checkmark")
                                    .foregroundStyle(skill.state == .ready ? .green : .orange)
                                VStack(alignment: .leading, spacing: 2) {
                                    Text(skill.title)
                                    Text(skill.state == .ready
                                         ? "Klar i prosjektet"
                                         : "Klar etter første godkjente lead")
                                        .font(.caption)
                                        .foregroundStyle(.secondary)
                                }
                                Spacer()
                                if skill.requiresConfirmation {
                                    Text("Bekreftes")
                                        .font(.caption2.weight(.semibold))
                                        .foregroundStyle(.secondary)
                                }
                            }
                        }
                    }

                    Section {
                        Label(
                            "Discovery-kandidater blir ikke leads før du godkjenner dem.",
                            systemImage: "hand.raised.fill"
                        )
                        .foregroundStyle(.secondary)

                        Button {
                            Task { await save() }
                        } label: {
                            HStack {
                                Spacer()
                                if isSaving {
                                    ProgressView().controlSize(.small)
                                }
                                Text(isSaving ? "Gjør prosjektet klart …" : "Opprett og åpne Discovery")
                                    .fontWeight(.semibold)
                                Spacer()
                            }
                        }
                        .buttonStyle(.borderedProminent)
                        .disabled(isSaving || profileError != nil || accessError != nil)
                        .accessibilityIdentifier("project-onboarding.commit")
                    }
                }

                if let completionResult, let access = completionResult.access {
                    Section("Tilgang er klar") {
                        Label("\(access.organization.name) er koblet til prosjektet", systemImage: "building.2.fill")
                        if let team = access.team {
                            Label("\(team.name) er koblet til prosjektet", systemImage: "person.3.fill")
                        }
                        accessStatusRow(
                            email: access.administrator.email,
                            status: access.administrator.status,
                            emailStatus: access.administrator.emailStatus,
                            label: "Kundeadmin"
                        )
                        ForEach(access.invitations, id: \.stableId) { invitation in
                            accessStatusRow(
                                email: invitation.email,
                                status: invitation.status,
                                emailStatus: invitation.emailStatus,
                                label: invitation.projectRole.title
                            )
                        }
                        Label(
                            access.discoveryAccessVerified
                                ? "Discovery-tilgang er verifisert"
                                : "Discovery-tilgang mangler",
                            systemImage: access.discoveryAccessVerified
                                ? "checkmark.shield.fill"
                                : "xmark.shield.fill"
                        )
                        .foregroundStyle(access.discoveryAccessVerified ? .green : .red)
                    }
                }

                if let errorMessage {
                    Section {
                        Label(errorMessage, systemImage: "exclamationmark.triangle.fill")
                            .foregroundStyle(.red)
                            .accessibilityIdentifier("project-onboarding.error")
                    }
                }
            }
            .safeAreaInset(edge: .top) {
                if completionResult?.access?.discoveryAccessVerified == true {
                    Label("Tilgang bekreftet – åpner Discovery", systemImage: "checkmark.shield.fill")
                        .font(.callout.weight(.semibold))
                        .foregroundStyle(.white)
                        .padding(.horizontal, 16)
                        .padding(.vertical, 10)
                        .frame(maxWidth: .infinity)
                        .background(Color.green)
                        .accessibilityIdentifier("project-onboarding.access-ready")
                }
            }
            .navigationTitle("Nytt kundeprosjekt")
            .navigationBarTitleDisplayMode(.inline)
            .interactiveDismissDisabled(isAnalyzing || isSaving)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Avbryt") { dismiss() }
                        .disabled(isAnalyzing || isSaving)
                }
            }
        }
    }

    @ViewBuilder
    private var accessSetupSection: some View {
        Section {
            Picker("Kundebedrift", selection: $organizationChoice) {
                Text("Opprett eller gjenbruk fra domenet").tag("create")
                ForEach(organizationOptions) { organization in
                    Text(organization.name).tag(organization.id)
                }
            }
            .accessibilityIdentifier("project-onboarding.organization")

            if organizationChoice == "create" {
                TextField("Selskapsnavn", text: $companyName)
                    .accessibilityIdentifier("project-onboarding.company-name")
            }

            TextField("Kundeadmin", text: $administratorEmail)
                .textContentType(.emailAddress)
                .keyboardType(.emailAddress)
                .textInputAutocapitalization(.never)
                .autocorrectionDisabled()
                .accessibilityIdentifier("project-onboarding.admin-email")

            Picker("Salgsteam", selection: $teamChoice) {
                Text("Opprett nytt team").tag("create")
                if !availableTeams.isEmpty {
                    Text("Velg eksisterende team").tag("existing")
                }
                Text("Ikke bruk team").tag("none")
            }
            if teamChoice == "create" {
                TextField("Teamnavn", text: $teamName)
                    .accessibilityIdentifier("project-onboarding.team-name")
            } else if teamChoice == "existing" {
                Picker("Eksisterende team", selection: $existingTeamId) {
                    Text("Velg team").tag("")
                    ForEach(availableTeams) { team in
                        Text(team.name).tag(team.id)
                    }
                }
            }

            ForEach($invitations) { $invitation in
                VStack(alignment: .leading, spacing: 8) {
                    TextField("navn@bedrift.no", text: $invitation.email)
                        .textContentType(.emailAddress)
                        .keyboardType(.emailAddress)
                        .textInputAutocapitalization(.never)
                        .autocorrectionDisabled()
                    Picker("Prosjektrolle", selection: $invitation.projectRole) {
                        ForEach(LeadgridProjectOnboardingProjectRole.allCases) { role in
                            Text(role.title).tag(role)
                        }
                    }
                    if teamChoice != "none" {
                        Picker("Teamrolle", selection: $invitation.teamRole) {
                            ForEach(LeadgridProjectOnboardingTeamRole.allCases) { role in
                                Text(role.title).tag(role)
                            }
                        }
                    }
                    Button("Fjern invitasjon", role: .destructive) {
                        invitations.removeAll { $0.id == invitation.id }
                    }
                }
            }

            if invitations.count < 20 {
                Button {
                    invitations.append(.init(
                        email: "",
                        projectRole: .member,
                        teamRole: teamChoice == "none" ? .none : .member
                    ))
                } label: {
                    Label("Inviter bruker", systemImage: "person.badge.plus")
                }
                .accessibilityIdentifier("project-onboarding.invitation.add")
            }
        } header: {
            Text("Bedrift og tilgang")
        } footer: {
            Text("Kundeadmin får eierrolle. Eksisterende brukere legges til direkte; nye brukere får en invitasjon med synlig leveringsstatus.")
        }
        .onChange(of: organizationChoice) { _, selected in
            guard selected != "create" else {
                availableTeams = []
                existingTeamId = ""
                if teamChoice == "existing" { teamChoice = "create" }
                return
            }
            Task { await loadTeams(for: selected) }
        }
    }

    private func accessStatusRow(
        email: String,
        status: String,
        emailStatus: String,
        label: String
    ) -> some View {
        HStack {
            VStack(alignment: .leading) {
                Text(email)
                Text(label).font(.caption).foregroundStyle(.secondary)
            }
            Spacer()
            Text(status == "active" ? "Aktiv" : (emailStatus == "sent" ? "Sendt" : "Invitert"))
                .font(.caption.weight(.semibold))
                .foregroundStyle(status == "active" || emailStatus == "sent" ? .green : .orange)
        }
    }

    @MainActor
    private func analyze() async {
        guard websiteError == nil else {
            errorMessage = websiteError
            return
        }
        isAnalyzing = true
        errorMessage = nil
        defer { isAnalyzing = false }
        do {
            let result = try await api.previewLeadgridProject(
                websiteURL: trimmedWebsite,
                organizationId: organizationId
            )
            preview = result
            profiles = result.recommendedProfiles
            website = result.websiteDomain
            if companyName.isEmpty { companyName = result.projectName }
            if administratorEmail.isEmpty { administratorEmail = defaultAdministratorEmail }
            if teamName.isEmpty { teamName = "\(result.projectName) salg" }
            let fallbackOrganizations = organizations.map {
                LeadgridProjectOnboardingAccessOptions.Organization(id: $0.id, name: $0.name)
            }
            if let accessOptions = try? await api.fetchLeadgridProjectOnboardingAccessOptions(
                sourceOrganizationId: organizationId
            ) {
                organizationOptions = accessOptions.organizations
            } else {
                organizationOptions = fallbackOrganizations
            }
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    @MainActor
    private func loadTeams(for targetOrganizationId: String) async {
        do {
            let options = try await api.fetchLeadgridProjectOnboardingAccessOptions(
                sourceOrganizationId: organizationId,
                targetOrganizationId: targetOrganizationId
            )
            guard organizationChoice == targetOrganizationId else { return }
            organizationOptions = options.organizations
            availableTeams = options.teams
            if !options.teams.contains(where: { $0.id == existingTeamId }) {
                existingTeamId = ""
                if teamChoice == "existing" { teamChoice = "create" }
            }
        } catch {
            guard organizationChoice == targetOrganizationId else { return }
            availableTeams = []
            existingTeamId = ""
            if teamChoice == "existing" { teamChoice = "create" }
            errorMessage = "Eksisterende team kunne ikke lastes. Du kan opprette et nytt team."
        }
    }

    @MainActor
    private func save() async {
        guard let preview else { return }
        if let profileError {
            errorMessage = profileError
            return
        }
        if let accessError {
            errorMessage = accessError
            return
        }
        isSaving = true
        errorMessage = nil
        do {
            let result = try await api.commitLeadgridProjectOnboarding(
                previewId: preview.id,
                organizationId: organizationId,
                profiles: preview.canManageMultipleProfiles ? profiles : nil,
                accessSetup: preview.canManageMultipleProfiles ? makeAccessSetup() : nil
            )
            isSaving = false
            if preview.canManageMultipleProfiles,
               result.access?.discoveryAccessVerified != true {
                errorMessage = "Prosjektet er lagret, men Discovery-tilgangen kunne ikke bekreftes."
                return
            }
            completionResult = result
            try? await Task.sleep(for: .milliseconds(1_400))
            onCompleted(result)
            dismiss()
        } catch {
            isSaving = false
            errorMessage = error.localizedDescription
        }
    }

    private func makeAccessSetup() -> LeadgridProjectOnboardingAccessSetup {
        let organization: LeadgridProjectOnboardingOrganizationSelection = organizationChoice == "create"
            ? .init(mode: "create", organizationId: nil, name: companyName.trimmingCharacters(in: .whitespacesAndNewlines))
            : .init(mode: "existing", organizationId: organizationChoice, name: nil)
        let team: LeadgridProjectOnboardingTeamSelection
        switch teamChoice {
        case "none":
            team = .init(mode: "none", id: nil, name: nil, colorHex: nil)
        case "existing":
            team = .init(mode: "existing", id: existingTeamId, name: nil, colorHex: nil)
        default:
            team = .init(
                mode: "create",
                id: nil,
                name: teamName.trimmingCharacters(in: .whitespacesAndNewlines),
                colorHex: "#A852FC"
            )
        }
        return .init(
            organization: organization,
            administratorEmail: administratorEmail.trimmingCharacters(in: .whitespacesAndNewlines).lowercased(),
            team: team,
            invitations: invitations.map { invitation in
                var normalized = invitation
                normalized.email = invitation.email.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
                if teamChoice == "none" { normalized.teamRole = .none }
                return normalized
            }
        )
    }

    private static func isValidEmail(_ value: String) -> Bool {
        let email = value.trimmingCharacters(in: .whitespacesAndNewlines)
        guard email.count <= 200,
              let at = email.firstIndex(of: "@"),
              at != email.startIndex
        else { return false }
        let domain = email[email.index(after: at)...]
        return domain.contains(".") && !domain.hasSuffix(".")
    }

    private func addProfile() {
        guard var copy = profiles.last ?? preview?.recommendedProfiles.first else { return }
        copy.name = "\(copy.name) \(profiles.count + 1)"
        copy.isDefault = false
        copy.expectedVersion = nil
        profiles.append(copy)
    }
}

private struct OnboardingDiscoveryProfileEditor: View {
    @Binding var profile: DiscoveryV2ProfileWrite
    let profileIndex: Int
    let canEdit: Bool
    let canDelete: Bool
    let onDelete: () -> Void

    @State private var isExpanded = false

    var body: some View {
        DisclosureGroup(isExpanded: $isExpanded) {
            VStack(alignment: .leading, spacing: 12) {
                if canEdit {
                    TextField("Profilnavn", text: $profile.name)
                        .accessibilityIdentifier("project-onboarding.profile.\(profileIndex).name")
                    TextField("Bransjer eller NACE-koder, kommaseparert", text: stringList(\.industryQueries))
                    TextField("Organisasjonsnavn-søk, kommaseparert", text: stringList(\.organizationNameQueries))
                    TextField("Eksklusjoner, kommaseparert", text: stringList(\.exclusionTerms))

                    Picker("Geografi", selection: areaMode) {
                        Text("Hele Norge").tag(OnboardingAreaMode.nationwide)
                        Text("By eller område").tag(OnboardingAreaMode.local)
                    }
                    .pickerStyle(.segmented)
                    .accessibilityIdentifier("project-onboarding.profile.\(profileIndex).area-mode")
                    if areaMode.wrappedValue == .local {
                        TextField("By eller område", text: cityText)
                            .accessibilityIdentifier("project-onboarding.profile.\(profileIndex).city")
                    }

                    Stepper("Kandidater: \(profile.brief.targetCount)", value: $profile.brief.targetCount, in: 1...60)
                    Stepper("Nettsidevurderinger: \(profile.brief.enrichmentCount)", value: $profile.brief.enrichmentCount, in: 1...profile.brief.targetCount)
                    Stepper("Minste fit-score: \(profile.brief.minimumFitScore)", value: $profile.brief.minimumFitScore, in: 0...100)

                    TextField("Idealkunde", text: optionalText(\.idealCustomer), axis: .vertical)
                        .lineLimit(2...5)
                    TextField("Mål", text: optionalText(\.goal), axis: .vertical)
                        .lineLimit(2...4)
                    TextField("Selskapsformer, f.eks. AS, ENK", text: stringList(\.organizationForms))

                    HStack {
                        TextField("Min. ansatte", value: employeeMinimum, format: .number)
                            .keyboardType(.numberPad)
                        TextField("Maks ansatte", value: employeeMaximum, format: .number)
                            .keyboardType(.numberPad)
                    }

                    Picker("Konsernstruktur", selection: $profile.brief.organizationStructure) {
                        ForEach(DiscoveryV2OrganizationStructure.allCases, id: \.self) { value in
                            Text(value.title).tag(value)
                        }
                    }
                    Picker("Nettsted", selection: $profile.brief.websiteRequirement) {
                        ForEach(DiscoveryV2WebsiteRequirement.allCases, id: \.self) { value in
                            Text(value.title).tag(value)
                        }
                    }
                    TextField("Min. nettstedscore", value: websiteMinimumScore, format: .number)
                        .keyboardType(.numberPad)
                    Picker("Foretaksregisteret", selection: businessRegisterSignal) {
                        ForEach(OnboardingTriState.allCases) { state in
                            Text(state.title).tag(state)
                        }
                    }
                    Picker("MVA-registeret", selection: vatRegisterSignal) {
                        ForEach(OnboardingTriState.allCases) { state in
                            Text(state.title).tag(state)
                        }
                    }
                    Toggle("Hent midlertidige Google Places-detaljer", isOn: $profile.placesDetailsEnabled)

                    if canDelete {
                        Button("Fjern profil", role: .destructive, action: onDelete)
                    }
                } else {
                    LabeledContent("Søk", value: querySummary)
                    LabeledContent("Område", value: profile.brief.areaSummary)
                    LabeledContent("Kandidater", value: String(profile.brief.targetCount))
                    LabeledContent("Minste fit-score", value: String(profile.brief.minimumFitScore))
                    if let idealCustomer = profile.brief.idealCustomer {
                        Text(idealCustomer).font(.caption).foregroundStyle(.secondary)
                    }
                }

                if let error = profile.brief.validationMessage {
                    Label(error, systemImage: "exclamationmark.triangle")
                        .font(.caption)
                        .foregroundStyle(.red)
                }
            }
            .padding(.top, 8)
        } label: {
            HStack {
                VStack(alignment: .leading) {
                    Text(profile.name)
                        .fontWeight(.semibold)
                        .accessibilityIdentifier("project-onboarding.profile.\(profileIndex).title")
                    Text(querySummary)
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }
                Spacer()
                if profile.isDefault {
                    Text("Standard")
                        .font(.caption2.weight(.semibold))
                        .foregroundStyle(.purple)
                }
            }
        }
        .accessibilityIdentifier("project-onboarding.profile.\(profileIndex)")
    }

    private func stringList(
        _ keyPath: WritableKeyPath<DiscoveryV2Brief, [String]>
    ) -> Binding<String> {
        Binding(
            get: { profile.brief[keyPath: keyPath].joined(separator: ", ") },
            set: { value in
                profile.brief[keyPath: keyPath] = value
                    .split(separator: ",")
                    .map { $0.trimmingCharacters(in: .whitespacesAndNewlines) }
                    .filter { !$0.isEmpty }
            }
        )
    }

    private var querySummary: String {
        let industries = profile.brief.industryQueries
        let organizationNames = profile.brief.organizationNameQueries.map { "navn: \($0)" }
        return (industries + organizationNames).joined(separator: ", ")
    }

    private func optionalText(
        _ keyPath: WritableKeyPath<DiscoveryV2Brief, String?>
    ) -> Binding<String> {
        Binding(
            get: { profile.brief[keyPath: keyPath] ?? "" },
            set: { value in
                let trimmed = value.trimmingCharacters(in: .whitespacesAndNewlines)
                profile.brief[keyPath: keyPath] = trimmed.isEmpty ? nil : trimmed
            }
        )
    }

    private var areaMode: Binding<OnboardingAreaMode> {
        Binding(
            get: { profile.brief.countryCode == "NO" ? .nationwide : .local },
            set: { mode in
                switch mode {
                case .nationwide:
                    profile.brief.countryCode = "NO"
                    profile.brief.city = nil
                    profile.brief.geo = nil
                    profile.brief.municipalityNumbers = []
                    profile.brief.municipalityNames = []
                case .local:
                    profile.brief.countryCode = nil
                    if profile.brief.city == nil,
                       profile.brief.geo == nil,
                       profile.brief.municipalityNumbers.isEmpty,
                       profile.brief.municipalityNames.isEmpty {
                        profile.brief.city = "Oslo"
                    }
                }
            }
        )
    }

    private var cityText: Binding<String> {
        Binding(
            get: { profile.brief.city ?? "" },
            set: { value in
                profile.brief.countryCode = nil
                profile.brief.city = value.isEmpty ? nil : value
                profile.brief.geo = nil
                profile.brief.municipalityNumbers = []
                profile.brief.municipalityNames = []
            }
        )
    }

    private var employeeMinimum: Binding<Int?> {
        Binding(
            get: { profile.brief.employeeCount?.minimum },
            set: { value in
                var filter = profile.brief.employeeCount ?? .init(minimum: nil, maximum: nil)
                filter.minimum = value
                profile.brief.employeeCount = filter.minimum == nil && filter.maximum == nil ? nil : filter
            }
        )
    }

    private var employeeMaximum: Binding<Int?> {
        Binding(
            get: { profile.brief.employeeCount?.maximum },
            set: { value in
                var filter = profile.brief.employeeCount ?? .init(minimum: nil, maximum: nil)
                filter.maximum = value
                profile.brief.employeeCount = filter.minimum == nil && filter.maximum == nil ? nil : filter
            }
        )
    }

    private var websiteMinimumScore: Binding<Int?> {
        Binding(
            get: { profile.brief.websiteQuality.minimumScore },
            set: { profile.brief.websiteQuality.minimumScore = $0.map { min(100, max(0, $0)) } }
        )
    }

    private var businessRegisterSignal: Binding<OnboardingTriState> {
        Binding(
            get: { .init(profile.brief.commercialSignals.registeredInBusinessRegister) },
            set: { profile.brief.commercialSignals.registeredInBusinessRegister = $0.boolValue }
        )
    }

    private var vatRegisterSignal: Binding<OnboardingTriState> {
        Binding(
            get: { .init(profile.brief.commercialSignals.registeredInVatRegister) },
            set: { profile.brief.commercialSignals.registeredInVatRegister = $0.boolValue }
        )
    }
}

private enum OnboardingAreaMode: String {
    case nationwide
    case local
}

private enum OnboardingTriState: String, CaseIterable, Identifiable {
    case any, yes, no
    var id: String { rawValue }
    var title: String {
        switch self {
        case .any: "Ikke filtrer"
        case .yes: "Ja"
        case .no: "Nei"
        }
    }
    var boolValue: Bool? {
        switch self {
        case .any: nil
        case .yes: true
        case .no: false
        }
    }
    init(_ value: Bool?) {
        self = switch value {
        case true: .yes
        case false: .no
        case nil: .any
        }
    }
}
