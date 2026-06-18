// MyProfileEditView.swift
//
// Selger redigerer sin egen profil. 4 påkrevde felter:
//   • Profilbilde
//   • E-post
//   • Telefon
//   • Tittel/yrke
//
// Validering vises som progress (0-4 av 4 utfylt). Først når alle er
// fyllt blir selgeren synlig som pin for resten av team-et.

import SwiftUI

struct MyProfileEditView: View {
    let api: APIClient
    @Environment(\.dismiss) private var dismiss

    @State private var profile: MyProfile?
    @State private var firstName = ""
    @State private var lastName = ""
    @State private var email = ""
    @State private var phone = ""
    @State private var profession = ""
    @State private var profileImageUrl = ""
    @State private var loading = true
    @State private var saving = false
    @State private var snackText: String?

    var body: some View {
        NavigationStack {
            Form {
                if loading {
                    HStack { Spacer(); ProgressView(); Spacer() }
                } else {
                    Section {
                        completionBar
                    }
                    Section("Profilbilde") {
                        avatarRow
                    }
                    Section("Navn") {
                        TextField("Fornavn", text: $firstName)
                        TextField("Etternavn", text: $lastName)
                    }
                    Section("E-post (påkrevd)") {
                        TextField("din@firma.no", text: $email)
                            .keyboardType(.emailAddress)
                            .textInputAutocapitalization(.never)
                            .autocorrectionDisabled()
                    }
                    Section("Telefon (påkrevd)") {
                        TextField("+47 ...", text: $phone)
                            .keyboardType(.phonePad)
                    }
                    Section("Tittel / yrke (påkrevd)") {
                        TextField("Eks: Salgskonsulent", text: $profession)
                    }
                    Section {
                        Label("Profil-bilde må også fylles ut for at du skal vises som selger-pin for resten av teamet.",
                               systemImage: "info.circle")
                            .font(.caption)
                            .foregroundStyle(.secondary)
                    }
                }
            }
            .navigationTitle("Min profil")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Lukk") { dismiss() }
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Lagre") {
                        Task { await save() }
                    }
                    .disabled(saving || loading)
                    .bold()
                }
            }
            .overlay(alignment: .bottom) {
                if let text = snackText {
                    Text(text)
                        .padding()
                        .background(.thinMaterial, in: Capsule())
                        .padding(.bottom, 20)
                        .transition(.move(edge: .bottom))
                }
            }
            .task { await load() }
        }
    }

    @ViewBuilder
    private var completionBar: some View {
        let p = profile?.profileCompletedCount ?? currentCompleted
        let t = profile?.profileTotalRequired ?? 4
        VStack(alignment: .leading, spacing: 6) {
            HStack {
                Text("Profil-fullstendighet")
                    .font(.caption.bold())
                Spacer()
                Text("\(p) av \(t) felter")
                    .font(.caption.bold())
                    .foregroundStyle(p == t ? .green : .orange)
            }
            ProgressView(value: Double(p), total: Double(t))
                .tint(p == t ? .green : .orange)
            if p == t {
                Label("Du er synlig som selger-pin", systemImage: "checkmark.circle.fill")
                    .font(.caption2)
                    .foregroundStyle(.green)
            } else {
                Label("Fyll ut alle 4 påkrevde for å bli synlig på kartet",
                       systemImage: "exclamationmark.triangle.fill")
                    .font(.caption2)
                    .foregroundStyle(.orange)
            }
        }
    }

    private var currentCompleted: Int {
        var n = 0
        if !profileImageUrl.isEmpty { n += 1 }
        if !email.isEmpty { n += 1 }
        if !phone.isEmpty { n += 1 }
        if !profession.isEmpty { n += 1 }
        return n
    }

    @ViewBuilder
    private var avatarRow: some View {
        HStack(spacing: 16) {
            if !profileImageUrl.isEmpty, let url = URL(string: profileImageUrl) {
                AsyncImage(url: url) { img in
                    img.resizable().aspectRatio(contentMode: .fill)
                } placeholder: {
                    Circle().fill(Color.secondary.opacity(0.20))
                }
                .frame(width: 64, height: 64)
                .clipShape(Circle())
            } else {
                Circle().fill(Color.purple.opacity(0.20))
                    .frame(width: 64, height: 64)
                    .overlay(
                        Image(systemName: "person.crop.circle.fill")
                            .font(.title)
                            .foregroundStyle(.purple),
                    )
            }
            VStack(alignment: .leading, spacing: 4) {
                TextField("Bilde-URL (https://...)", text: $profileImageUrl)
                    .textInputAutocapitalization(.never)
                    .autocorrectionDisabled()
                    .font(.caption)
                Text("Lim inn URL til profilbildet ditt")
                    .font(.caption2)
                    .foregroundStyle(.secondary)
            }
        }
    }

    private func load() async {
        do {
            let res = try await api.fetchMyProfile()
            await MainActor.run {
                profile = res.profile
                firstName = res.profile.firstName ?? ""
                lastName = res.profile.lastName ?? ""
                email = res.profile.email ?? ""
                phone = res.profile.phone ?? ""
                profession = res.profile.profession ?? ""
                profileImageUrl = res.profile.profileImageUrl ?? ""
                loading = false
            }
        } catch {
            await MainActor.run {
                snackText = "Kunne ikke laste: \(error.localizedDescription)"
                loading = false
            }
        }
    }

    private func save() async {
        saving = true
        defer { saving = false }
        do {
            let res = try await api.patchMyProfile([
                "first_name": firstName.isEmpty ? nil : firstName,
                "last_name": lastName.isEmpty ? nil : lastName,
                "email": email.isEmpty ? nil : email,
                "phone": phone.isEmpty ? nil : phone,
                "profession": profession.isEmpty ? nil : profession,
                "profile_image_url": profileImageUrl.isEmpty ? nil : profileImageUrl,
            ])
            await MainActor.run {
                profile = res.profile
                flash("Profil lagret")
            }
        } catch {
            await MainActor.run {
                flash("Lagring feilet: \(error.localizedDescription)")
            }
        }
    }

    private func flash(_ text: String) {
        Task { @MainActor in
            withAnimation { snackText = text }
            try? await Task.sleep(nanoseconds: 2_500_000_000)
            withAnimation { snackText = nil }
        }
    }
}
