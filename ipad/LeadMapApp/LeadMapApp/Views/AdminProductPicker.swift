// AdminProductPicker.swift
//
// SwiftUI-pille for å bytte mellom Role Room og Leadgrid som aktiv
// Admin Room-kontekst (PR #827 paritet — web bruker ProductSwitcher
// med ?bizProduct=role_room|leadgrid på AdminRoom.tsx).
//
// Når brukeren bytter:
//   1. AppState.activeAdminProduct oppdateres (UserDefaults-persistert)
//   2. Avhengige views observerer endringen via @Environment(AppState)
//      og laster på nytt med riktig ?product= på backend-kallene
//
// Caching av admin-room-data er ikke i OfflineCache enda — hver bytte
// re-fetcher fra backend. Når GRDB-cache senere får business-plan/
// outreach-tabeller må cache-keys prefikses med produkt-keyen
// (eller bruk product_key som kolonne) for å unngå sammenblanding.

import SwiftUI

struct AdminProductPicker: View {
    @Environment(AppState.self) private var appState

    var body: some View {
        @Bindable var state = appState
        Picker("Produkt", selection: $state.activeAdminProduct) {
            ForEach(AdminProductKey.allCases) { product in
                Label(product.shortName, systemImage: product.systemImage)
                    .tag(product)
            }
        }
        .pickerStyle(.segmented)
        .accessibilityIdentifier("admin-product-picker")
    }
}

/// Toolbar-variant (kompakt menu i nav-bar). Brukes der `.segmented`
/// tar for mye plass — f.eks. SuperAdminHub-listen.
struct AdminProductToolbarMenu: View {
    @Environment(AppState.self) private var appState

    var body: some View {
        Menu {
            ForEach(AdminProductKey.allCases) { product in
                Button {
                    appState.activeAdminProduct = product
                } label: {
                    if appState.activeAdminProduct == product {
                        Label(product.displayName, systemImage: "checkmark")
                    } else {
                        Label(product.displayName, systemImage: product.systemImage)
                    }
                }
            }
        } label: {
            HStack(spacing: 4) {
                Image(systemName: appState.activeAdminProduct.systemImage)
                Text(appState.activeAdminProduct.shortName)
                    .font(.subheadline.weight(.semibold))
                Image(systemName: "chevron.down")
                    .font(.caption2)
            }
            .padding(.horizontal, 10)
            .padding(.vertical, 5)
            .background(
                Color.purple.opacity(0.15),
                in: Capsule(),
            )
            .foregroundStyle(.purple)
        }
        .accessibilityLabel("Bytt admin-produkt")
        .accessibilityIdentifier("admin-product-toolbar-menu")
    }
}
