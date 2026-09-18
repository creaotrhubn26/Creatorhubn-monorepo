// MockPaywallSheet.swift
//
// Mock-paywall (beslutning 17.09.2026): én pris, én knapp «Lås opp (demo)»,
// tilstand lagres lokalt per område. Ingen leverandør; ekte løsning blir
// StoreKit 2 (App Store krever IAP for digitalt innhold).

import SwiftUI

struct MockPaywallSheet: View {
    let areaId: String

    @Environment(AppEnvironment.self) private var env
    @Environment(\.dismiss) private var dismiss
    @Environment(\.contrastColors) private var contrast

    private var priceText: String {
        let price = env.store.area?.priceNok ?? 59
        return price.formatted(.currency(code: "NOK").precision(.fractionLength(0)).locale(env.settings.locale))
    }

    var body: some View {
        VStack(alignment: .leading, spacing: AppSpacing.l) {
            Image(systemName: "lock.open.fill")
                .font(.largeTitle)
                .foregroundStyle(AppColor.accent)
                .accessibilityHidden(true)
            Text("paywall.title")
                .font(AppFont.screenTitle)
                .foregroundStyle(AppColor.textPrimary)
                .asHeader()
            Text(env.store.area?.name ?? "")
                .font(AppFont.body)
                .foregroundStyle(contrast.textSecondary)
            Text("paywall.body")
                .font(AppFont.body)
                .foregroundStyle(contrast.textSecondary)
            Text(priceText)
                .font(AppFont.heroTitle)
                .foregroundStyle(AppColor.textPrimary)
                .padding(.top, AppSpacing.s)
            Spacer()
            PrimaryButton(title: "paywall.unlockDemo", systemImage: "lock.open") {
                env.settings.unlock(areaId: areaId)
                dismiss()
            }
            Text("paywall.demoNote")
                .font(.caption)
                .foregroundStyle(contrast.textTertiary)
                .frame(maxWidth: .infinity)
        }
        .padding(AppSpacing.screenMargin)
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
        .background(AppColor.bgBase)
        .presentationDetents([.medium, .large])
        .presentationDragIndicator(.visible)
    }
}
