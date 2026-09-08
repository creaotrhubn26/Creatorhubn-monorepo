import SwiftUI

struct ProjectDomainOnboardingView: View {
    let api: APIClient
    let organizationId: String
    let onCompleted: (LeadgridProjectOnboardingResult) -> Void

    @Environment(\.dismiss) private var dismiss
    @State private var website = ""
    @State private var preview: LeadgridProjectOnboardingPreview?
    @State private var profiles: [DiscoveryV2ProfileWrite] = []
    @State private var isAnalyzing = false
    @State private var isSaving = false
    @State private var errorMessage: String?

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
                        .disabled(isSaving || profileError != nil)
                        .accessibilityIdentifier("project-onboarding.commit")
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
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    @MainActor
    private func save() async {
        guard let preview else { return }
        if let profileError {
            errorMessage = profileError
            return
        }
        isSaving = true
        errorMessage = nil
        do {
            let result = try await api.commitLeadgridProjectOnboarding(
                previewId: preview.id,
                organizationId: organizationId,
                profiles: preview.canManageMultipleProfiles ? profiles : nil
            )
            onCompleted(result)
            isSaving = false
            dismiss()
        } catch {
            isSaving = false
            errorMessage = error.localizedDescription
        }
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
                    TextField("Kundetyper, kommaseparert", text: stringList(\.industryQueries))
                    TextField("Eksklusjoner, kommaseparert", text: stringList(\.exclusionTerms))
                    TextField("By eller område", text: optionalText(\.city))

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
                    LabeledContent("Kundetyper", value: profile.brief.industryQueries.joined(separator: ", "))
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
                    Text(profile.name).fontWeight(.semibold)
                    Text(profile.brief.industryQueries.joined(separator: ", "))
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
