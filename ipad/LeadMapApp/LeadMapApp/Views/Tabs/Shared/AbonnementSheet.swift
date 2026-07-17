// AbonnementSheet.swift — org-ens eget abonnements-overblikk (2026-07-17).
//
// Daniel: «finnes det en oversikt for organisasjonen til å se abonnementet
// sitt … og hvilke funksjoner de har?» — API-ene fantes (Fase 16: fakturaer
// + Stripe-portal; entitlements-envelopen), men ingen flate viste dem.
//
// Innhold:
//   1. Plan-kort — plan fra /me/entitlements (rå backend-nøkkel, prettifisert)
//   2. Funksjoner — feature-matrisen sett fra org-en (Inkludert/Tillegg/
//      Prøve/Låst per funksjon, gruppert). AI-strukturering vises KUN når
//      eksplisitt aktivert (default-av-prinsippet: null referanse ellers).
//   3. Fakturahistorikk — fra Stripe via backend (status/beløp/PDF)
//   4. «Administrer betaling» — Stripe kundeportal i Safari
//
// Åpnes fra ProfilePopover (kun admin/salgssjef). Ærlige tom-tilstander:
// org uten Stripe-kobling ser det — vi later ikke som det finnes fakturaer.

import SwiftUI

private enum AbBrand {
    static let bg = Color(red: 0.05, green: 0.04, blue: 0.10)
    static let card = Color(red: 0.10, green: 0.09, blue: 0.16)
    static let cardHi = Color(red: 0.13, green: 0.11, blue: 0.20)
    static let stroke = Color.white.opacity(0.06)
    static let purple = Color(red: 0.66, green: 0.32, blue: 0.99)
    static let purpleLight = Color(red: 0.75, green: 0.45, blue: 1.0)
    static let green = Color(red: 0.20, green: 0.85, blue: 0.60)
    static let orange = Color(red: 0.98, green: 0.55, blue: 0.10)
    static let blue = Color(red: 0.34, green: 0.60, blue: 0.98)
    static let red = Color(red: 0.95, green: 0.20, blue: 0.20)
    static let textSecondary = Color.white.opacity(0.65)
    static let textTertiary = Color.white.opacity(0.40)
}

struct AbonnementSheet: View {
    @Environment(AppState.self) private var appState
    @Environment(\.dismiss) private var dismiss
    @ObservedObject private var entitlements = EntitlementStore.shared

    @State private var planKey: String?
    @State private var loadedEnvelope = false
    @State private var invoices: [LeadgridBillingInvoice] = []
    @State private var invoicesLoading = true
    @State private var invoicesError = false
    @State private var portalLoading = false
    @State private var toast: String?

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 16) {
                    planCard
                    featureSection
                    invoiceSection
                    Color.clear.frame(height: 20)
                }
                .padding(.horizontal, 16)
                .padding(.top, 14)
            }
            .background(AbBrand.bg.ignoresSafeArea())
            .navigationTitle("Abonnement")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button("Ferdig") { dismiss() }
                        .foregroundStyle(AbBrand.purpleLight)
                }
            }
            .toolbarBackground(AbBrand.bg, for: .navigationBar)
            .toolbarBackground(.visible, for: .navigationBar)
            .toolbarColorScheme(.dark, for: .navigationBar)
            .overlay(alignment: .bottom) {
                if let t = toast {
                    Label(t, systemImage: "info.circle.fill")
                        .font(.appScaled(size: 12, weight: .bold))
                        .foregroundStyle(.white)
                        .padding(.horizontal, 14).padding(.vertical, 8)
                        .background(AbBrand.cardHi, in: Capsule())
                        .overlay(Capsule().stroke(AbBrand.stroke, lineWidth: 1))
                        .padding(.bottom, 16)
                        .transition(.opacity)
                }
            }
            .animation(.easeInOut(duration: 0.2), value: toast)
        }
        .preferredColorScheme(.dark)
        .presentationDragIndicator(.visible)
        .task { await load() }
    }

    // MARK: Datalasting

    private func load() async {
        guard let api = appState.api else {
            invoicesLoading = false
            return
        }
        async let envelopeTask = try? api.fetchMyEntitlements(
            organizationId: appState.activeOrganizationId)
        async let invoicesTask = try? api.fetchLeadgridBillingInvoices()
        let envelope = await envelopeTask
        let inv = await invoicesTask
        planKey = envelope?.plan
        loadedEnvelope = true
        if let inv {
            invoices = inv.invoices
        } else {
            invoicesError = true
        }
        invoicesLoading = false
    }

    // MARK: Plan-kort

    /// Backend-plan-nøkler er rå («solo_pro»/«agency»/…) — prettifisér.
    private var planDisplay: String {
        switch (planKey ?? "").lowercased() {
        case "solo_pro": return "Solo Pro"
        case "agency": return "Agency"
        case "": return "Ingen aktiv plan"
        default: return (planKey ?? "").split(separator: "_")
            .map { $0.prefix(1).uppercased() + $0.dropFirst() }
            .joined(separator: " ")
        }
    }

    private var planCard: some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack(spacing: 12) {
                ZStack {
                    RoundedRectangle(cornerRadius: 12)
                        .fill(LinearGradient(colors: [AbBrand.purple, AbBrand.purpleLight],
                                             startPoint: .topLeading, endPoint: .bottomTrailing))
                    Image(systemName: "creditcard.fill")
                        .font(.appScaled(size: 18, weight: .bold))
                        .foregroundStyle(.white)
                }
                .frame(width: 44, height: 44)
                VStack(alignment: .leading, spacing: 2) {
                    Text(loadedEnvelope ? planDisplay : "Laster …")
                        .font(.appScaled(size: 17, weight: .black))
                        .foregroundStyle(.white)
                    Text(planKey == nil && loadedEnvelope
                         ? "Organisasjonen er ikke koblet til fakturering enda"
                         : "Organisasjonens Leadgrid-plan")
                        .font(.appScaled(size: 11))
                        .foregroundStyle(AbBrand.textSecondary)
                }
                Spacer()
            }
            // Stripe kundeportal: fakturaer, betalingsmetode, kansellering.
            Button {
                Task { await openPortal() }
            } label: {
                HStack(spacing: 6) {
                    if portalLoading {
                        ProgressView().tint(.white)
                    } else {
                        Image(systemName: "gearshape.fill")
                            .font(.appScaled(size: 12, weight: .bold))
                    }
                    Text("Administrer betaling")
                        .font(.appScaled(size: 13, weight: .bold))
                }
                .foregroundStyle(.white)
                .frame(maxWidth: .infinity)
                .padding(.vertical, 12)
                .background(AbBrand.cardHi, in: RoundedRectangle(cornerRadius: 11))
                .overlay(RoundedRectangle(cornerRadius: 11).stroke(AbBrand.stroke, lineWidth: 1))
            }
            .buttonStyle(.plain)
            .disabled(portalLoading)
        }
        .padding(14)
        .background(AbBrand.card, in: RoundedRectangle(cornerRadius: 14))
        .overlay(RoundedRectangle(cornerRadius: 14).stroke(AbBrand.stroke, lineWidth: 1))
    }

    private func openPortal() async {
        guard let api = appState.api else { return }
        portalLoading = true
        defer { portalLoading = false }
        do {
            let resp = try await api.createBillingPortalSession()
            if let url = URL(string: resp.url) {
                await UIApplication.shared.open(url)
            }
        } catch {
            // 404 = org uten Stripe-kunde — ærlig beskjed, ikke stille feil.
            flash("Ikke koblet til fakturering enda — kontakt Leadgrid")
        }
    }

    private func flash(_ text: String) {
        toast = text
        DispatchQueue.main.asyncAfter(deadline: .now() + 2.4) {
            if toast == text { toast = nil }
        }
    }

    // MARK: Funksjoner (feature-matrisen sett fra org-en)

    /// Default-av-features (AI) vises KUN når eksplisitt aktivert —
    /// samme null-referanse-prinsipp som resten av appen.
    private func visibleFeatures(in group: LeadgridFeature.Group) -> [LeadgridFeature] {
        LeadgridFeature.allCases.filter { f in
            guard f.group == group else { return false }
            if f == .leadbookAIStrukturering {
                return entitlements.isExplicitlyEnabled(f)
            }
            return true
        }
    }

    private var featureSection: some View {
        VStack(alignment: .leading, spacing: 10) {
            sectionTitle("Funksjoner i planen")
            if !entitlements.hasServerEntitlements {
                Text("Alle funksjoner er åpne for organisasjonen din (standard-tilgang).")
                    .font(.appScaled(size: 11))
                    .foregroundStyle(AbBrand.textSecondary)
            }
            ForEach(LeadgridFeature.Group.allCases) { group in
                let feats = visibleFeatures(in: group)
                if !feats.isEmpty {
                    VStack(alignment: .leading, spacing: 6) {
                        HStack(spacing: 6) {
                            Image(systemName: group.icon)
                                .font(.appScaled(size: 10, weight: .semibold))
                                .foregroundStyle(group.tint)
                            Text(group.rawValue)
                                .font(.appScaled(size: 11, weight: .black))
                                .foregroundStyle(AbBrand.textSecondary)
                                .textCase(.uppercase)
                                .tracking(0.6)
                        }
                        VStack(spacing: 4) {
                            ForEach(feats) { f in featureRow(f) }
                        }
                    }
                }
            }
        }
        .padding(14)
        .background(AbBrand.card, in: RoundedRectangle(cornerRadius: 14))
        .overlay(RoundedRectangle(cornerRadius: 14).stroke(AbBrand.stroke, lineWidth: 1))
    }

    private func featureRow(_ f: LeadgridFeature) -> some View {
        HStack(spacing: 9) {
            Image(systemName: f.icon)
                .font(.appScaled(size: 11, weight: .semibold))
                .foregroundStyle(AbBrand.purpleLight)
                .frame(width: 20)
            Text(f.rawValue)
                .font(.appScaled(size: 12, weight: .medium))
                .foregroundStyle(.white)
                .lineLimit(1)
            Spacer(minLength: 6)
            stateChip(for: f)
        }
        .padding(.vertical, 3)
    }

    @ViewBuilder
    private func stateChip(for f: LeadgridFeature) -> some View {
        switch entitlements.access(f) {
        case .included:
            chip("Inkludert", AbBrand.green)
        case .trial:
            chip("Prøve", AbBrand.orange)
        case .addOn:
            if let price = entitlements.entitlements[f]?.addOnPriceMonthly, price > 0 {
                chip("Tillegg · \(price) kr/mnd", AbBrand.blue)
            } else {
                chip("Tillegg", AbBrand.blue)
            }
        case .locked:
            chip("Låst", AbBrand.textTertiary)
        }
    }

    private func chip(_ text: String, _ tint: Color) -> some View {
        Text(text)
            .font(.appScaled(size: 9, weight: .bold))
            .foregroundStyle(tint)
            .padding(.horizontal, 7).padding(.vertical, 3)
            .background(tint.opacity(0.14), in: Capsule())
            .overlay(Capsule().stroke(tint.opacity(0.35), lineWidth: 1))
    }

    // MARK: Fakturaer

    private var invoiceSection: some View {
        VStack(alignment: .leading, spacing: 10) {
            sectionTitle("Fakturaer")
            if invoicesLoading {
                HStack(spacing: 8) {
                    ProgressView().tint(AbBrand.purpleLight)
                    Text("Henter fakturaer …")
                        .font(.appScaled(size: 11, weight: .semibold))
                        .foregroundStyle(AbBrand.textSecondary)
                }
                .frame(maxWidth: .infinity)
                .padding(.vertical, 14)
            } else if invoicesError {
                Text("Kunne ikke hente fakturaer — sjekk nettverket")
                    .font(.appScaled(size: 11, weight: .semibold))
                    .foregroundStyle(.white.opacity(0.55))
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 14)
            } else if invoices.isEmpty {
                Text("Ingen fakturaer enda")
                    .font(.appScaled(size: 11, weight: .semibold))
                    .foregroundStyle(.white.opacity(0.55))
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 14)
            } else {
                VStack(spacing: 6) {
                    ForEach(invoices) { inv in invoiceRow(inv) }
                }
            }
        }
        .padding(14)
        .background(AbBrand.card, in: RoundedRectangle(cornerRadius: 14))
        .overlay(RoundedRectangle(cornerRadius: 14).stroke(AbBrand.stroke, lineWidth: 1))
    }

    private func invoiceRow(_ inv: LeadgridBillingInvoice) -> some View {
        let (label, tint): (String, Color) = {
            switch inv.status {
            case "paid": return ("Betalt", AbBrand.green)
            case "open": return ("Åpen", AbBrand.orange)
            case "void": return ("Annullert", AbBrand.textTertiary)
            case "uncollectible": return ("Misligholdt", AbBrand.red)
            default: return (inv.status, AbBrand.textTertiary)
            }
        }()
        return Button {
            // Stripe-hostet faktura-side (fallback PDF) i Safari.
            let urlStr = inv.hostedInvoiceUrl ?? inv.invoicePdfUrl
            if let s = urlStr, let url = URL(string: s) {
                UIApplication.shared.open(url)
            }
        } label: {
            HStack(spacing: 10) {
                Image(systemName: "doc.text.fill")
                    .font(.appScaled(size: 12, weight: .semibold))
                    .foregroundStyle(AbBrand.purpleLight)
                VStack(alignment: .leading, spacing: 1) {
                    Text(inv.number ?? String(inv.id.prefix(12)))
                        .font(.appScaled(size: 12, weight: .bold))
                        .foregroundStyle(.white)
                        .lineLimit(1)
                    if let d = inv.createdAt {
                        Text(String(d.prefix(10)))
                            .font(.appScaled(size: 10))
                            .foregroundStyle(AbBrand.textTertiary)
                            .monospacedDigit()
                    }
                }
                Spacer()
                Text(inv.formattedAmount)
                    .font(.appScaled(size: 12, weight: .bold, design: .rounded))
                    .foregroundStyle(.white)
                    .monospacedDigit()
                chip(label, tint)
            }
            .padding(10)
            .background(AbBrand.cardHi, in: RoundedRectangle(cornerRadius: 10))
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .disabled(inv.hostedInvoiceUrl == nil && inv.invoicePdfUrl == nil)
    }

    private func sectionTitle(_ t: String) -> some View {
        Text(t)
            .font(.appScaled(size: 13, weight: .bold))
            .foregroundStyle(.white)
    }
}
