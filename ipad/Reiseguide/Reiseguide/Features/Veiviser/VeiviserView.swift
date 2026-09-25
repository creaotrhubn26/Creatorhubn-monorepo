// VeiviserView.swift
//
// Veiviseren (UI pakke 2, item 5): stor pil mot et valgt sted eller «neste
// sted» i ruten, med avstand og klokke-/kompassretning. For blinde brukere
// er talen (VeiviserViewModel: announcement eller AVSpeechSynthesizer)
// hovedkanalen; pilen og teksten er for svaksynte og seende. Nås fra
// severdighetssiden («Vis veien») og kartets nærmeste-kort.

import SwiftUI
import UIKit

struct VeiviserView: View {
    let target: VeiviserTarget
    @Binding var path: NavigationPath

    @Environment(AppEnvironment.self) private var env
    @Environment(\.contrastColors) private var contrast
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @Environment(\.dismiss) private var dismiss

    @State private var model: VeiviserViewModel?

    var body: some View {
        Group {
            if let model {
                content(model)
            } else {
                Color.clear.frame(maxWidth: .infinity, maxHeight: .infinity)
            }
        }
        .background(AppColor.bgBase)
        .preferredColorScheme(.dark)
        .toolbar(.hidden, for: .navigationBar)
        .onAppear {
            guard model == nil else { return }
            let viewModel = VeiviserViewModel(
                target: target,
                store: env.store,
                location: env.location,
                visits: env.visits,
                settings: env.settings,
                player: env.player
            )
            model = viewModel
            viewModel.start()
        }
        .onDisappear { model?.stop() }
    }

    private func content(_ model: VeiviserViewModel) -> some View {
        VStack(spacing: 0) {
            topBar
                .padding(.horizontal, AppSpacing.screenMargin)
                .padding(.top, AppSpacing.s)
            Spacer(minLength: AppSpacing.l)
            if let poi = model.poi {
                targetBlock(model, poi: poi)
            } else {
                noTargetBlock
            }
            Spacer(minLength: AppSpacing.l)
            if env.location.authorization == .denied {
                ErrorStripe(message: L10n.string("map.locationDenied", lang: env.settings.uiLanguage), actionTitle: "map.openSettings") {
                    if let url = URL(string: UIApplication.openSettingsURLString) { UIApplication.shared.open(url) }
                }
                .padding(.horizontal, AppSpacing.screenMargin)
                .padding(.bottom, AppSpacing.m)
            }
            controls(model)
                .padding(.horizontal, AppSpacing.screenMargin)
                .padding(.bottom, AppSpacing.xl)
        }
    }

    private var topBar: some View {
        HStack {
            IconCircleButton(systemImage: "chevron.down", label: "action.close") {
                if path.isEmpty { dismiss() } else { path.removeLast() }
            }
            Spacer()
        }
    }

    @ViewBuilder
    private func targetBlock(_ model: VeiviserViewModel, poi: GuidePOI) -> some View {
        VStack(spacing: AppSpacing.l) {
            arrow(model)
            Text(poi.title)
                .font(AppFont.screenTitle)
                .foregroundStyle(AppColor.textPrimary)
                .multilineTextAlignment(.center)
                .asHeader()
            if model.hasArrived {
                arrivedBlock
            } else {
                directionBlock(model)
                stepBlock(model)
            }
        }
        .padding(.horizontal, AppSpacing.screenMargin)
    }

    /// Turn-by-turn (pakke 2, item 1): gjeldende manøver og av-rute-varsel,
    /// under kompassretningen — som en ekstra detalj, ikke en erstatning for
    /// den (gangrute med steg kan mangle helt, kompasset virker uansett).
    @ViewBuilder
    private func stepBlock(_ model: VeiviserViewModel) -> some View {
        VStack(spacing: AppSpacing.s) {
            if model.isOffRoute {
                Label("veiviser.offRoute", systemImage: "arrow.triangle.turn.up.right.diamond")
                    .font(AppFont.subtitle)
                    .foregroundStyle(AppColor.error)
            } else if let instructions = model.currentStepInstructions {
                Label(instructions, systemImage: "arrow.turn.up.right")
                    .font(AppFont.subtitle)
                    .foregroundStyle(contrast.textSecondary)
                    .multilineTextAlignment(.center)
            }
        }
        .padding(.top, AppSpacing.s)
        .accessibilityElement(children: .combine)
    }

    private func arrow(_ model: VeiviserViewModel) -> some View {
        let rotation = model.hasArrived ? 0 : (model.relativeAngleDeg ?? 0)
        return ZStack {
            Circle().fill(AppColor.bgSurface)
            Image(systemName: model.hasArrived ? "checkmark" : "location.north.fill")
                .font(.system(size: 72))
                .foregroundStyle(AppColor.accent)
                .rotationEffect(.degrees(rotation))
                .opacity(model.hasArrived || model.isHeadingAvailable ? 1 : 0.45)
                .animation(reduceMotion ? nil : .easeInOut(duration: 0.3), value: rotation)
        }
        .frame(width: 180, height: 180)
        .accessibilityHidden(true)
    }

    private func directionBlock(_ model: VeiviserViewModel) -> some View {
        VStack(spacing: AppSpacing.s) {
            if let distanceM = model.distanceM {
                Text(L10n.distance(meters: distanceM, locale: env.settings.locale))
                    .font(AppFont.heroTitle)
                    .foregroundStyle(AppColor.textPrimary)
                    .monospacedDigit()
            }
            Text(directionText(model))
                .font(AppFont.subtitle)
                .foregroundStyle(contrast.textSecondary)
                .multilineTextAlignment(.center)
            if !model.isHeadingAvailable, model.distanceM != nil {
                Text("veiviser.noHeadingHint")
                    .font(.caption)
                    .foregroundStyle(contrast.textTertiary)
                    .multilineTextAlignment(.center)
            }
        }
        .accessibilityElement(children: .combine)
        .accessibilityAddTraits(.updatesFrequently)
    }

    private func directionText(_ model: VeiviserViewModel) -> String {
        let lang = env.settings.uiLanguage
        if let bucket = model.clockBucket {
            return L10n.string("veiviser.clockLabel", lang: lang).replacingOccurrences(of: "%@", with: "\(bucket)")
        }
        if let key = model.compassWordKey {
            return L10n.string(key, lang: lang)
        }
        return L10n.string("veiviser.locating", lang: lang)
    }

    private var arrivedBlock: some View {
        Text("veiviser.arrivedTitle")
            .font(AppFont.cardTitle)
            .foregroundStyle(AppColor.textPrimary)
            .accessibilityElement(children: .combine)
    }

    private var noTargetBlock: some View {
        Text("veiviser.noTarget")
            .font(AppFont.body)
            .foregroundStyle(contrast.textSecondary)
            .multilineTextAlignment(.center)
            .padding(.horizontal, AppSpacing.screenMargin)
    }

    @ViewBuilder
    private func controls(_ model: VeiviserViewModel) -> some View {
        @Bindable var settings = env.settings
        VStack(spacing: AppSpacing.m) {
            SecondaryButton(title: "veiviser.repeat", systemImage: "speaker.wave.2") {
                model.repeatDirection()
            }
            .accessibilityHint(Text("veiviser.repeatHint"))
            .disabled(model.poi == nil)
            Toggle(isOn: $settings.speakDirectionsEnabled) {
                Text("veiviser.speakToggle")
                    .foregroundStyle(AppColor.textPrimary)
            }
            .tint(AppColor.accent)
            .frame(minHeight: AppSpacing.minTapTarget)
        }
    }
}
