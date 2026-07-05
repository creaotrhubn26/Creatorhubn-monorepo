// SharedProfileAvatar.swift
//
// Delt header-avatar for alle 7 hovedfaner. Løftet fra Leadbook-fanens
// rike Menu-implementasjon så alle fanene ser identiske ut i header:
//
// Meny-innhold:
//   - Min profil
//   - Pondus overalt (Watch)
//   - Team-tilganger
//   - «Leadgrid-ansatt» → SuperAdmin-konsoll (vises hvis appState.isSuperAdmin)
//   - Innstillinger
//   - Logg ut
//
// Avatar-bilde:
//   - Bruker `SmartPortrait` hvis en asset for innlogget bruker finnes
//   - Faller tilbake til initialer-badge (fra `AppState.initials`) ellers
//
// Callbacks:
//   - Fanen sender inn @State-flag som Bindings, så åpning av modal
//     forblir kontekstuell til hvor avataren tap'es. Alt går utenom
//     denne komponenten så vi ikke pusher shared state gjennom
//     AppState for enkle UI-modaler.

import SwiftUI

struct SharedProfileAvatar: View {
    @Environment(AppState.self) private var appState

    /// Fane-brand-farge — brukes til stroke rundt portrettet + hover-tint.
    let tint: Color
    /// Bakgrunn på selve avatar-pillen. Fane-typisk `card`-farge.
    let background: Color
    /// Stroke på pillen (samme som fane-typisk `stroke`).
    let borderColor: Color
    /// Sekundær tekst-farge (for «Salgssjef» + chevron).
    let secondaryText: Color
    let tertiaryText: Color

    /// Skjul navn+rolle-tekst i smale layouter.
    let isCompact: Bool

    /// Callback-Bindings som fanen bruker til å styre sine egne sheets.
    /// Vi bruker Bindings istedenfor closures så SwiftUI får full state-
    /// integrasjon (sheet-presentation-modifiers ligger i fanen).
    @Binding var showMinProfil: Bool
    @Binding var showEcosystem: Bool
    @Binding var showTeamAccess: Bool
    @Binding var showSuperAdmin: Bool

    var body: some View {
        menuBody
            .task {
                if appState.isSuperAdmin, let api = appState.api {
                    OrgModeStore.shared.attach(api: api)
                }
            }
    }

    private var menuBody: some View {
        Menu {
            Button { showMinProfil = true } label: {
                Label("Min profil", systemImage: "person.circle")
            }
            Button { showEcosystem = true } label: {
                Label("Pondus overalt", systemImage: "applewatch")
            }
            // Team-tilganger flyttet til Team-fanen (User 2026-07-01):
            // RBAC-innstillinger hører hjemme i Team-fanens header,
            // ikke i den globale profil-menyen.
            Divider()
            // Kun synlig for Leadgrid-ansatte (isSuperAdmin), matcher
            // Leadbook-fanens gating. Vanlige brukere ser ikke seksjonen.
            if appState.isSuperAdmin {
                Section("Leadgrid-ansatt") {
                    Button { showSuperAdmin = true } label: {
                        Label("SuperAdmin-konsoll", systemImage: "crown.fill")
                    }
                    // Org-modus (mig 0365): se appen i valgfri modus —
                    // solo eller en hvilken som helst org. Bytte
                    // refresher alle org-avhengige datakilder.
                    if !OrgModeStore.shared.modes.isEmpty {
                        Menu {
                            ForEach(OrgModeStore.shared.modes) { mode in
                                Button {
                                    OrgModeStore.shared.switchTo(mode.id, appState: appState)
                                } label: {
                                    if mode.isCurrent {
                                        Label(mode.label, systemImage: "checkmark")
                                    } else {
                                        Text(mode.label)
                                    }
                                }
                            }
                        } label: {
                            Label("Org-modus", systemImage: "building.2.crop.circle")
                        }
                    }
                }
                Divider()
            }
            Button {} label: {
                Label("Innstillinger", systemImage: "gearshape")
            }
            Button(role: .destructive) {} label: {
                Label("Logg ut", systemImage: "rectangle.portrait.and.arrow.right")
            }
        } label: {
            HStack(spacing: 8) {
                avatarImage
                    .frame(width: 34, height: 34)
                    .overlay(Circle().stroke(tint.opacity(0.4), lineWidth: 1.5))
                if !isCompact {
                    VStack(alignment: .leading, spacing: 0) {
                        Text(appState.displayName)
                            .font(.appScaled(size: 12, weight: .semibold))
                            .foregroundStyle(.white)
                            .lineLimit(1)
                            .fixedSize()
                        Text(appState.isSuperAdmin ? "Leadgrid-admin" : "Salgssjef")
                            .font(.appScaled(size: 10))
                            .foregroundStyle(secondaryText)
                            .lineLimit(1)
                            .fixedSize()
                    }
                    Image(systemName: "chevron.down")
                        .font(.appScaled(size: 9, weight: .semibold))
                        .foregroundStyle(tertiaryText)
                }
            }
            .padding(.horizontal, 8).padding(.vertical, 5)
            .background(background, in: RoundedRectangle(cornerRadius: 11))
            .overlay(RoundedRectangle(cornerRadius: 11).stroke(borderColor, lineWidth: 1))
        }
        .macCatalystHover()
        // Stabil id for QA-harnessen (SuperAdmin-sveipet åpner menyen).
        .accessibilityIdentifier("shared-profile-avatar")
    }

    /// Prøver å laste en asset «portrait-<email-local-part>» — hvis den
    /// ikke finnes, faller vi tilbake til initialer på farget bakgrunn.
    @ViewBuilder
    private var avatarImage: some View {
        let assetName = portraitAssetName
        if UIImage(named: assetName) != nil {
            SmartPortrait(assetName: assetName)
        } else {
            ZStack {
                Circle().fill(tint.opacity(0.3))
                Text(appState.initials)
                    .font(.appScaled(size: 12, weight: .bold))
                    .foregroundStyle(tint)
            }
        }
    }

    /// «daniel@creatorhubn.com» → «portrait-daniel».
    /// «kari.hansen@…» → «portrait-kari.hansen».
    private var portraitAssetName: String {
        guard let email = appState.userEmail,
              let local = email.split(separator: "@").first else {
            return "portrait-lars"  // Legacy default
        }
        return "portrait-\(local.lowercased())"
    }
}
