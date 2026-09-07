// MinProfil.swift — kanonisk profilflate for Leadgrid.

import PhotosUI
import SwiftUI
import UIKit

struct MinProfilSheet: View {
    @Environment(AppState.self) private var appState
    @Environment(\.dismiss) private var dismiss
    @Environment(\.openURL) private var openURL

    @State private var showEditProfile = false
    @State private var showLogoutConfirm = false
    @State private var showRemovePhotoConfirm = false
    @State private var showFeedback = false
    @State private var photoItem: PhotosPickerItem?
    @State private var photoError: String?
    @State private var toast: String?
    @State private var exporting = false
    @State private var exportError: String?
    @State private var exportURL: URL?
    @State private var showExportShare = false
    @State private var myEquipment: [APIClient.EquipmentDTO] = []
    @State private var equipmentLoaded = false

    private var store: ProfileStore { appState.profileStore }
    private var profile: MyProfile? { store.profile }

    private var roleTitle: String {
        switch appState.roleInOrg {
        case "admin": return "Administrator"
        case "salgssjef": return "Salgssjef"
        case "teamleder": return "Teamleder"
        case "salgskonsulent": return "Salgskonsulent"
        case "kvalitet": return "Kvalitetskontrollør"
        case "promotor": return "Promotør"
        case .some(let role): return role.replacingOccurrences(of: "_", with: " ").capitalized
        case nil: return "Medlem"
        }
    }

    private var profileImageURL: URL? {
        guard let raw = profile?.profileImageUrl,
              let url = URL(string: raw),
              ["https", "http"].contains(url.scheme?.lowercased() ?? "")
        else { return nil }
        return url
    }

    private var myLeads: [LeadModel] {
        let userId = profile?.userId
        let email = (profile?.email ?? appState.userEmail)?.lowercased()
        return appState.leads.filter { lead in
            if let userId, lead.assignedUserId == userId { return true }
            if let email, lead.assignedUserEmail?.lowercased() == email { return true }
            return false
        }
    }

    private var wonLeads: [LeadModel] { myLeads.filter { $0.status == .won } }
    private var wonValue: Double { wonLeads.compactMap(\.estimatedValue).reduce(0, +) }

    var body: some View {
        NavigationStack {
            ZStack {
                LBrand.bg.ignoresSafeArea()
                profileContent
                toastOverlay
            }
            .navigationTitle("Min profil")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar { toolbarContent }
            .task {
                await store.load()
                await loadEquipment()
            }
            .onChange(of: photoItem) { _, item in
                guard let item else { return }
                Task { await importPortrait(item) }
            }
            .onChange(of: showExportShare) { _, isPresented in
                guard !isPresented, let exportURL else { return }
                try? FileManager.default.removeItem(at: exportURL)
                self.exportURL = nil
            }
            .sheet(isPresented: $showEditProfile) {
                EditMyProfileSheet(profile: profile) {
                    showToast("Profil lagret")
                }
                .environment(appState)
            }
            .sheet(isPresented: $showFeedback) {
                if let api = appState.api {
                    LeadgridFeedbackSheet(api: api)
                } else {
                    ContentUnavailableView(
                        "Ikke tilgjengelig",
                        systemImage: "wifi.slash",
                        description: Text("Koble til og logg inn for å sende tilbakemelding.")
                    )
                }
            }
            .sheet(isPresented: $showExportShare) {
                if let exportURL { ShareSheet(items: [exportURL]) }
            }
            .confirmationDialog(
                "Fjerne profilbildet?",
                isPresented: $showRemovePhotoConfirm,
                titleVisibility: .visible
            ) {
                Button("Fjern bilde", role: .destructive) {
                    Task { await removePortrait() }
                }
                Button("Avbryt", role: .cancel) {}
            }
            .confirmationDialog(
                "Logge ut av Leadgrid?",
                isPresented: $showLogoutConfirm,
                titleVisibility: .visible
            ) {
                Button("Logg ut", role: .destructive) {
                    dismiss()
                    appState.signOut()
                }
                Button("Avbryt", role: .cancel) {}
            }
        }
        .preferredColorScheme(.dark)
        .macCatalystSheetSize(minWidth: 760, minHeight: 700)
        .accessibilityIdentifier("profile-screen")
    }

    @ViewBuilder
    private var profileContent: some View {
        switch store.loadState {
        case .idle, .loading:
            ProgressView("Laster profilen …")
                .tint(LBrand.purpleLight)
                .foregroundStyle(.white)
        case .failed(let message):
            ContentUnavailableView {
                Label("Kunne ikke laste profilen", systemImage: "person.crop.circle.badge.exclamationmark")
            } description: {
                Text(message)
            } actions: {
                Button("Prøv igjen") { Task { await store.load(force: true) } }
                    .buttonStyle(.borderedProminent)
                    .tint(LBrand.purple)
                    .accessibilityIdentifier("profile-retry-button")
            }
        case .loaded:
            ScrollView {
                VStack(alignment: .leading, spacing: 18) {
                    heroCard
                    completionCard
                    statisticsGrid
                    contactCard
                    equipmentCard
                    accountCard
                    Color.clear.frame(height: 12)
                }
                .frame(maxWidth: 920)
                .padding(20)
                .frame(maxWidth: .infinity)
            }
            .refreshable { await store.load(force: true) }
        }
    }

    private var heroCard: some View {
        let photoButtonLabel = profileImageURL == nil ? "Legg til bilde" : "Bytt bilde"
        return VStack(spacing: 14) {
            ZStack(alignment: .bottomTrailing) {
                LeadgridProfileAvatar(
                    imageURL: profileImageURL,
                    initials: appState.initials,
                    size: 104,
                    tint: LBrand.purpleLight
                )
                if store.isUploadingImage {
                    ProgressView()
                        .tint(.white)
                        .padding(9)
                        .background(LBrand.purple, in: Circle())
                } else {
                    Image(systemName: "camera.fill")
                        .font(.appScaled(size: 13, weight: .bold))
                        .foregroundStyle(.white)
                        .padding(9)
                        .background(LBrand.purple, in: Circle())
                        .overlay(Circle().stroke(LBrand.bg, lineWidth: 3))
                }
            }

            VStack(spacing: 4) {
                Text(appState.displayName)
                    .font(.appScaled(size: 25, weight: .bold, design: .rounded))
                    .foregroundStyle(.white)
                    .multilineTextAlignment(.center)
                    .accessibilityIdentifier("profile-display-name")
                Text(roleTitle)
                    .font(.appScaled(size: 14, weight: .semibold))
                    .foregroundStyle(LBrand.purpleLight)
                if let organization = appState.activeOrganization?.name {
                    Text(organization)
                        .font(.appScaled(size: 13))
                        .foregroundStyle(LBrand.textSecondary)
                }
            }

            HStack(spacing: 10) {
                PhotosPicker(selection: $photoItem, matching: .images) {
                    Label(photoButtonLabel, systemImage: "photo.on.rectangle")
                        .frame(minHeight: 44)
                }
                .buttonStyle(.borderedProminent)
                .tint(LBrand.purple)
                .disabled(store.isUploadingImage)
                .accessibilityIdentifier("profile-photo-picker")

                if profileImageURL != nil {
                    Button(role: .destructive) { showRemovePhotoConfirm = true } label: {
                        Label("Fjern", systemImage: "trash")
                            .frame(minHeight: 44)
                    }
                    .buttonStyle(.bordered)
                    .disabled(store.isUploadingImage)
                    .accessibilityIdentifier("profile-photo-remove")
                }
            }

            if let photoError {
                Label(photoError, systemImage: "exclamationmark.triangle.fill")
                    .font(.appScaled(size: 12, weight: .semibold))
                    .foregroundStyle(LBrand.red)
                    .multilineTextAlignment(.center)
                    .accessibilityIdentifier("profile-error-image")
            }
        }
        .frame(maxWidth: .infinity)
        .padding(22)
        .background(
            LinearGradient(
                colors: [LBrand.purple.opacity(0.30), LBrand.card],
                startPoint: .topLeading,
                endPoint: .bottomTrailing
            ),
            in: RoundedRectangle(cornerRadius: 20)
        )
        .overlay(RoundedRectangle(cornerRadius: 20).stroke(LBrand.purple.opacity(0.35)))
    }

    private var completionCard: some View {
        let completed = profile?.profileCompletedCount ?? 0
        let total = max(profile?.profileTotalRequired ?? 4, 1)
        return VStack(alignment: .leading, spacing: 10) {
            HStack {
                Label("Profilfullstendighet", systemImage: "checkmark.seal.fill")
                    .font(.appScaled(size: 14, weight: .bold))
                    .foregroundStyle(.white)
                Spacer()
                Text("\(completed) av \(total)")
                    .font(.appScaled(size: 13, weight: .bold, design: .rounded))
                    .foregroundStyle(completed == total ? LBrand.green : LBrand.orange)
                    .monospacedDigit()
            }
            ProgressView(value: Double(completed), total: Double(total))
                .tint(completed == total ? LBrand.green : LBrand.orange)
            Text(completionMessage)
                .font(.appScaled(size: 12))
                .foregroundStyle(LBrand.textSecondary)
        }
        .padding(16)
        .background(LBrand.card, in: RoundedRectangle(cornerRadius: 14))
        .overlay(RoundedRectangle(cornerRadius: 14).stroke(LBrand.stroke))
    }

    private var completionMessage: String {
        var missing: [String] = []
        if profileImageURL == nil { missing.append("profilbilde") }
        if profile?.email?.isEmpty != false { missing.append("e-post") }
        if profile?.phone?.isEmpty != false { missing.append("telefon") }
        if profile?.profession?.isEmpty != false { missing.append("tittel") }
        return missing.isEmpty
            ? "Profilen din er komplett."
            : "Mangler: " + missing.joined(separator: ", ") + "."
    }

    private var statisticsGrid: some View {
        LazyVGrid(columns: [GridItem(.adaptive(minimum: 150), spacing: 12)], spacing: 12) {
            metricCard(title: "Mine leads", value: "\(myLeads.count)", icon: "person.2.fill", color: LBrand.purpleLight)
            metricCard(title: "Vunnet", value: "\(wonLeads.count)", icon: "trophy.fill", color: LBrand.green)
            metricCard(
                title: "Vunnet verdi",
                value: wonValue.formatted(.currency(code: "NOK").precision(.fractionLength(0)).locale(Locale(identifier: "nb_NO"))),
                icon: "banknote.fill",
                color: LBrand.orange
            )
        }
        .accessibilityIdentifier("profile-real-stats")
    }

    private func metricCard(title: String, value: String, icon: String, color: Color) -> some View {
        VStack(alignment: .leading, spacing: 10) {
            Image(systemName: icon)
                .font(.appScaled(size: 17, weight: .bold))
                .foregroundStyle(color)
            Text(value)
                .font(.appScaled(size: 22, weight: .bold, design: .rounded))
                .foregroundStyle(.white)
                .lineLimit(1)
                .minimumScaleFactor(0.7)
            Text(title)
                .font(.appScaled(size: 12, weight: .semibold))
                .foregroundStyle(LBrand.textSecondary)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(15)
        .background(LBrand.card, in: RoundedRectangle(cornerRadius: 14))
        .overlay(RoundedRectangle(cornerRadius: 14).stroke(LBrand.stroke))
    }

    private var contactCard: some View {
        sectionCard(title: "PROFILOPPLYSNINGER") {
            infoRow(icon: "envelope.fill", label: "E-post", value: profile?.email ?? appState.userEmail ?? "Ikke registrert", tint: LBrand.blue)
            Divider().overlay(LBrand.stroke)
            infoRow(icon: "phone.fill", label: "Telefon", value: profile?.phone ?? "Ikke registrert", tint: LBrand.green)
            Divider().overlay(LBrand.stroke)
            infoRow(icon: "briefcase.fill", label: "Tittel / profesjon", value: profile?.profession ?? "Ikke registrert", tint: LBrand.purpleLight)
            Divider().overlay(LBrand.stroke)
            infoRow(icon: "building.2.fill", label: "Organisasjon", value: appState.activeOrganization?.name ?? "Ingen aktiv organisasjon", tint: LBrand.orange)

            Button { showEditProfile = true } label: {
                Label("Rediger profil", systemImage: "pencil")
                    .font(.appScaled(size: 14, weight: .bold))
                    .foregroundStyle(.white)
                    .frame(maxWidth: .infinity, minHeight: 46)
                    .background(LBrand.purple, in: RoundedRectangle(cornerRadius: 12))
            }
            .buttonStyle(.plain)
            .padding(.top, 6)
            .accessibilityIdentifier("profile-edit-button")
        }
    }

    @ViewBuilder
    private var equipmentCard: some View {
        if equipmentLoaded, !myEquipment.isEmpty {
            sectionCard(title: "MITT UTSTYR") {
                ForEach(myEquipment) { item in
                    infoRow(
                        icon: UtstyrKind.icon(item.kind),
                        label: item.label,
                        value: equipmentSubtitle(item),
                        tint: LBrand.purpleLight
                    )
                    if item.id != myEquipment.last?.id {
                        Divider().overlay(LBrand.stroke)
                    }
                }
            }
        }
    }

    private var accountCard: some View {
        sectionCard(title: "KONTO OG PERSONVERN") {
            Button { openURL(URL(string: "https://theroleroom.com/innstillinger/sikkerhet")!) } label: {
                actionRow(icon: "lock.shield.fill", label: "Sikkerhet og 2FA på web", tint: LBrand.green)
            }
            .buttonStyle(.plain)
            .accessibilityIdentifier("profile-security-link")
            Divider().overlay(LBrand.stroke)
            Button { openNotificationSettings() } label: {
                actionRow(icon: "bell.badge.fill", label: "Varslingsinnstillinger", tint: LBrand.orange)
            }
            .buttonStyle(.plain)
            Divider().overlay(LBrand.stroke)
            Button { Task { await exportMyData() } } label: {
                actionRow(
                    icon: "square.and.arrow.down.fill",
                    label: exporting ? "Forbereder eksport …" : "Last ned mine data",
                    tint: LBrand.blue,
                    showProgress: exporting
                )
            }
            .buttonStyle(.plain)
            .disabled(exporting)
            .accessibilityIdentifier("profile-export-button")
            if let exportError {
                Text(exportError)
                    .font(.appScaled(size: 12, weight: .semibold))
                    .foregroundStyle(LBrand.red)
                    .accessibilityIdentifier("profile-error-export")
            }
            Divider().overlay(LBrand.stroke)
            Button { showFeedback = true } label: {
                actionRow(icon: "star.bubble.fill", label: "Gi tilbakemelding", tint: LBrand.purpleLight)
            }
            .buttonStyle(.plain)
            Divider().overlay(LBrand.stroke)
            Button(role: .destructive) { showLogoutConfirm = true } label: {
                actionRow(icon: "rectangle.portrait.and.arrow.right", label: "Logg ut", tint: LBrand.red, showsChevron: false)
            }
            .buttonStyle(.plain)
        }
    }

    @ToolbarContentBuilder
    private var toolbarContent: some ToolbarContent {
        ToolbarItem(placement: .cancellationAction) {
            Button("Lukk") { dismiss() }
                .tint(LBrand.textSecondary)
        }
        ToolbarItem(placement: .confirmationAction) {
            Button("Rediger") { showEditProfile = true }
                .fontWeight(.semibold)
                .tint(LBrand.purpleLight)
                .accessibilityIdentifier("profile-edit-toolbar-button")
        }
    }

    @ViewBuilder
    private var toastOverlay: some View {
        if let toast {
            VStack {
                Label(toast, systemImage: "checkmark.circle.fill")
                    .font(.appScaled(size: 13, weight: .bold))
                    .foregroundStyle(.white)
                    .padding(.horizontal, 14)
                    .padding(.vertical, 10)
                    .background(LBrand.green, in: Capsule())
                    .shadow(radius: 8)
                    .padding(.top, 12)
                Spacer()
            }
            .transition(.move(edge: .top).combined(with: .opacity))
            .allowsHitTesting(false)
        }
    }

    private func sectionCard<Content: View>(title: String, @ViewBuilder content: () -> Content) -> some View {
        VStack(alignment: .leading, spacing: 12) {
            Text(title)
                .font(.appScaled(size: 11, weight: .black))
                .foregroundStyle(LBrand.textTertiary)
                .tracking(0.9)
            content()
        }
        .padding(16)
        .background(LBrand.card, in: RoundedRectangle(cornerRadius: 14))
        .overlay(RoundedRectangle(cornerRadius: 14).stroke(LBrand.stroke))
    }

    private func infoRow(icon: String, label: String, value: String, tint: Color) -> some View {
        HStack(spacing: 12) {
            Image(systemName: icon)
                .font(.appScaled(size: 13, weight: .bold))
                .foregroundStyle(tint)
                .frame(width: 34, height: 34)
                .background(tint.opacity(0.18), in: Circle())
            VStack(alignment: .leading, spacing: 2) {
                Text(label)
                    .font(.appScaled(size: 11))
                    .foregroundStyle(LBrand.textSecondary)
                Text(value)
                    .font(.appScaled(size: 14, weight: .semibold))
                    .foregroundStyle(.white)
                    .textSelection(.enabled)
            }
            Spacer(minLength: 4)
        }
    }

    private func actionRow(
        icon: String,
        label: String,
        tint: Color,
        showProgress: Bool = false,
        showsChevron: Bool = true
    ) -> some View {
        HStack(spacing: 12) {
            Image(systemName: icon)
                .font(.appScaled(size: 13, weight: .bold))
                .foregroundStyle(tint)
                .frame(width: 34, height: 34)
                .background(tint.opacity(0.18), in: RoundedRectangle(cornerRadius: 9))
            Text(label)
                .font(.appScaled(size: 14, weight: .semibold))
                .foregroundStyle(.white)
            Spacer()
            if showProgress {
                ProgressView().tint(tint)
            } else if showsChevron {
                Image(systemName: "chevron.right")
                    .font(.appScaled(size: 11, weight: .bold))
                    .foregroundStyle(LBrand.textTertiary)
            }
        }
        .frame(minHeight: 44)
        .contentShape(Rectangle())
    }

    private func equipmentSubtitle(_ item: APIClient.EquipmentDTO) -> String {
        var parts: [String] = []
        if let serial = item.serialNumber, !serial.isEmpty { parts.append("SN \(serial)") }
        if let assignedAt = item.assignedAt, assignedAt.count >= 10 {
            parts.append("utlevert \(assignedAt.prefix(10))")
        }
        return parts.isEmpty ? UtstyrKind.label(item.kind) : parts.joined(separator: " · ")
    }

    private func loadEquipment() async {
        guard !equipmentLoaded else { return }
        guard let api = appState.api else {
            equipmentLoaded = true
            return
        }
        myEquipment = (try? await api.fetchMyEquipment()) ?? []
        equipmentLoaded = true
    }

    private func importPortrait(_ item: PhotosPickerItem) async {
        photoError = nil
        do {
            guard let source = try await item.loadTransferable(type: Data.self) else {
                throw ProfileImageError.unreadable
            }
            let jpeg = try ProfileImageProcessor.jpegData(from: source)
            _ = try await store.uploadImage(jpeg)
            showToast("Profilbildet er oppdatert")
        } catch {
            appState.handleAPIError(error)
            if case APIError.validation(let fields) = error {
                photoError = fields["profile_image"] ?? error.localizedDescription
            } else {
                photoError = error.localizedDescription
            }
        }
        photoItem = nil
    }

    private func removePortrait() async {
        photoError = nil
        do {
            _ = try await store.removeImage()
            showToast("Profilbildet er fjernet")
        } catch {
            appState.handleAPIError(error)
            photoError = error.localizedDescription
        }
    }

    private func exportMyData() async {
        guard let api = appState.api else {
            exportError = "Du må være innlogget for å laste ned data."
            return
        }
        exporting = true
        exportError = nil
        defer { exporting = false }
        do {
            let json = try await api.fetchMyDataExport()
            let url = FileManager.default.temporaryDirectory
                .appendingPathComponent("leadgrid-mine-data-\(Int(Date().timeIntervalSince1970)).json")
            try Data(json.utf8).write(to: url, options: .atomic)
            exportURL = url
            showExportShare = true
        } catch {
            appState.handleAPIError(error)
            exportError = "Kunne ikke laste ned data: \(error.localizedDescription)"
        }
    }

    private func openNotificationSettings() {
        if let url = URL(string: UIApplication.openNotificationSettingsURLString) {
            openURL(url)
        }
    }

    private func showToast(_ message: String) {
        withAnimation { toast = message }
        Task { @MainActor in
            try? await Task.sleep(for: .seconds(1.8))
            withAnimation { toast = nil }
        }
    }
}

struct EditMyProfileSheet: View {
    @Environment(AppState.self) private var appState
    @Environment(\.dismiss) private var dismiss

    let profile: MyProfile?
    var onSaved: () -> Void

    @State private var draft: ProfileDraft
    @State private var fieldErrors: [ProfileField: String] = [:]
    @State private var generalError: String?
    @FocusState private var focusedField: ProfileField?

    init(profile: MyProfile?, onSaved: @escaping () -> Void = {}) {
        self.profile = profile
        self.onSaved = onSaved
        _draft = State(initialValue: ProfileDraft(profile: profile))
    }

    var body: some View {
        NavigationStack {
            ZStack {
                LBrand.bg.ignoresSafeArea()
                ScrollView {
                    VStack(alignment: .leading, spacing: 16) {
                        Text("E-postadressen er innloggingsidentiteten din og kan bare endres gjennom en verifisert kontoflyt.")
                            .font(.appScaled(size: 12))
                            .foregroundStyle(LBrand.textSecondary)
                            .padding(13)
                            .frame(maxWidth: .infinity, alignment: .leading)
                            .background(LBrand.card, in: RoundedRectangle(cornerRadius: 12))

                        readOnlyEmail
                        profileField(
                            "Telefon",
                            text: $draft.phone,
                            placeholder: "+47 900 00 000",
                            field: .phone,
                            maximum: ProfileDraft.phoneMaxLength,
                            keyboard: .phonePad,
                            contentType: .telephoneNumber
                        )
                        profileField(
                            "Fornavn",
                            text: $draft.firstName,
                            placeholder: "Fornavn",
                            field: .firstName,
                            maximum: ProfileDraft.firstNameMaxLength,
                            contentType: .givenName
                        )
                        profileField(
                            "Etternavn",
                            text: $draft.lastName,
                            placeholder: "Etternavn",
                            field: .lastName,
                            maximum: ProfileDraft.lastNameMaxLength,
                            contentType: .familyName
                        )
                        profileField(
                            "Tittel / profesjon",
                            text: $draft.profession,
                            placeholder: "For eksempel Salgskonsulent",
                            field: .profession,
                            maximum: ProfileDraft.professionMaxLength,
                            contentType: .jobTitle
                        )

                        if let generalError {
                            Label(generalError, systemImage: "exclamationmark.triangle.fill")
                                .font(.appScaled(size: 12, weight: .semibold))
                                .foregroundStyle(LBrand.red)
                                .accessibilityIdentifier("profile-error-form")
                        }
                    }
                    .frame(maxWidth: 620)
                    .padding(20)
                    .frame(maxWidth: .infinity)
                }
                .scrollDismissesKeyboard(.immediately)
            }
            .navigationTitle("Rediger profil")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Avbryt") { dismiss() }
                        .tint(LBrand.textSecondary)
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button { Task { await save() } } label: {
                        if appState.profileStore.isSaving {
                            ProgressView().tint(.white)
                        } else {
                            Text("Lagre").fontWeight(.bold)
                        }
                    }
                    .disabled(appState.profileStore.isSaving)
                    .tint(LBrand.purpleLight)
                    .accessibilityIdentifier("profile-save-button")
                }
                ToolbarItemGroup(placement: .keyboard) {
                    Spacer()
                    Button("Ferdig") { focusedField = nil }
                        .fontWeight(.semibold)
                        .accessibilityIdentifier("profile-keyboard-done")
                }
            }
        }
        .preferredColorScheme(.dark)
        .macCatalystSheetSize(minWidth: 620, minHeight: 620)
        .accessibilityIdentifier("profile-edit-screen")
        .onChange(of: draft) { _, _ in
            // Valider mens brukeren skriver, slik at feil rettes før innsending.
            fieldErrors = draft.validationErrors
            generalError = nil
        }
    }

    private var readOnlyEmail: some View {
        VStack(alignment: .leading, spacing: 7) {
            Text("E-post")
                .font(.appScaled(size: 12, weight: .bold))
                .foregroundStyle(LBrand.textSecondary)
            HStack {
                Text(profile?.email ?? appState.userEmail ?? "Ikke registrert")
                    .font(.appScaled(size: 15, weight: .medium))
                    .foregroundStyle(.white)
                    .textSelection(.enabled)
                Spacer()
                Image(systemName: "lock.fill")
                    .foregroundStyle(LBrand.textTertiary)
            }
            .padding(13)
            .background(LBrand.cardHi, in: RoundedRectangle(cornerRadius: 11))
        }
        .accessibilityIdentifier("profile-email-readonly")
    }

    private func profileField(
        _ title: String,
        text: Binding<String>,
        placeholder: String,
        field: ProfileField,
        maximum: Int,
        keyboard: UIKeyboardType = .default,
        contentType: UITextContentType? = nil
    ) -> some View {
        VStack(alignment: .leading, spacing: 7) {
            HStack {
                Text(title)
                    .font(.appScaled(size: 12, weight: .bold))
                    .foregroundStyle(LBrand.textSecondary)
                Spacer()
                Text("\(text.wrappedValue.count)/\(maximum)")
                    .font(.appScaled(size: 10, weight: .medium, design: .monospaced))
                    .foregroundStyle(text.wrappedValue.count > maximum ? LBrand.red : LBrand.textTertiary)
                    .monospacedDigit()
            }
            TextField(placeholder, text: text)
                .keyboardType(keyboard)
                .textContentType(contentType)
                .textInputAutocapitalization(field == .phone ? .never : .words)
                .autocorrectionDisabled(field != .profession)
                .font(.appScaled(size: 15))
                .focused($focusedField, equals: field)
                .foregroundStyle(.white)
                .padding(13)
                .background(LBrand.cardHi, in: RoundedRectangle(cornerRadius: 11))
                .overlay(
                    RoundedRectangle(cornerRadius: 11)
                        .stroke(fieldErrors[field] == nil ? LBrand.stroke : LBrand.red, lineWidth: 1)
                )
                .accessibilityIdentifier("profile-field-\(accessibilitySuffix(field))")
            if let error = fieldErrors[field] {
                Text(error)
                    .font(.appScaled(size: 11, weight: .semibold))
                    .foregroundStyle(LBrand.red)
                    .accessibilityIdentifier("profile-error-\(accessibilitySuffix(field))")
            }
        }
    }

    private func accessibilitySuffix(_ field: ProfileField) -> String {
        switch field {
        case .firstName: return "first-name"
        case .lastName: return "last-name"
        case .phone: return "phone"
        case .profession: return "profession"
        case .form: return "form"
        case .profileImage: return "image"
        }
    }

    private func save() async {
        fieldErrors = draft.validationErrors
        generalError = nil
        guard fieldErrors.isEmpty else { return }

        do {
            _ = try await appState.profileStore.save(draft)
            onSaved()
            dismiss()
        } catch ProfileStoreError.validation(let errors) {
            fieldErrors = errors
        } catch APIError.validation(let fields) {
            for (key, message) in fields {
                if let field = ProfileField(rawValue: key) {
                    fieldErrors[field] = message
                } else {
                    generalError = message
                }
            }
        } catch {
            appState.handleAPIError(error)
            generalError = error.localizedDescription
        }
    }
}
