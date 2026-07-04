// LeadgridHeaderMark.swift
//
// Leadgrid-lockup som brand-merke i fane-headerne (2026-07-04).
// Produkt-branding i appen er alltid Leadgrid — kunde-orgens egen
// branding gjelder kun utgående dokumenter (tilbud/rapporter/e-post).

import SwiftUI

struct LeadgridHeaderMark: View {
    var height: CGFloat = 30

    var body: some View {
        Image("LeadgridLockup")
            .resizable()
            .scaledToFit()
            .frame(height: height)
            .accessibilityHidden(true)   // dekorativt — fanetittel bærer semantikken
    }
}
