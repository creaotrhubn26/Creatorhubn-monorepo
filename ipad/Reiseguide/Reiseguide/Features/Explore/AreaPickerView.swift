// AreaPickerView.swift
//
// Områdevelgeren (Lørenskog, Nesoddtangen, Oslo …): en enkel liste, ikke et
// kart, så den virker likt med VoiceOver og store tekststørrelser. Hver rad
// viser navn og antall steder og leses som «Lørenskog, 4 steder, valgt».
// Ett trykk velger og lukker, så veien til «spill av» er kortest mulig.
// Nås fra Utforsk (AreaPill ved tittelen, som sheet) og fra Innstillinger
// (pushet i navigasjonsstacken). Uten nett vises lagret liste eller området
// som vises nå, med en tydelig melding.

import SwiftUI

struct AreaPickerView: View {
    /// Sheet fra Utforsk har egen Lukk-knapp; pushet fra Innstillinger har Tilbake.
    var showsCloseButton = false

    @Environment(AppEnvironment.self) private var env
    @Environment(\.dismiss) private var dismiss
    @Environment(\.contrastColors) private var contrast

    private var rows: [GuideArea] {
        AreaSelection.pickerAreas(fetched: env.store.areas, current: env.store.area)
    }

    var body: some View {
        List {
            if env.store.areasState == .failed {
                Section {
                    ErrorStripe(
                        message: L10n.string(rows.isEmpty ? "area.offlineEmpty" : "area.offline", lang: env.settings.uiLanguage),
                        actionTitle: "action.retry",
                        action: { Task { await env.store.loadAreas() } }
                    )
                    .listRowInsets(EdgeInsets())
                    .listRowBackground(Color.clear)
                }
            }
            Section {
                if rows.isEmpty, env.store.areasState != .failed {
                    HStack(spacing: AppSpacing.m) {
                        ProgressView()
                        Text("state.loading")
                            .foregroundStyle(contrast.textSecondary)
                    }
                    .frame(minHeight: AppSpacing.minTapTarget)
                    .accessibilityElement(children: .combine)
                    .listRowBackground(AppColor.bgSurface)
                }
                ForEach(rows) { area in
                    AreaRow(
                        area: area,
                        isSelected: area.slug == env.store.slug,
                        uiLanguage: env.settings.uiLanguage
                    ) {
                        env.selectArea(area)
                        dismiss()
                    }
                    .listRowBackground(AppColor.bgSurface)
                }
            } footer: {
                Text("area.footer")
                    .foregroundStyle(contrast.textSecondary)
            }
        }
        .scrollContentBackground(.hidden)
        .background(AppColor.bgBase)
        .navigationTitle("area.pickerTitle")
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            if showsCloseButton {
                ToolbarItem(placement: .cancellationAction) {
                    Button("action.close") { dismiss() }
                        .minTapTarget()
                }
            }
        }
        .refreshable { await env.store.loadAreas() }
        .task { await env.store.loadAreas() }
    }
}

/// Én rad: navn og antall steder, hake på valgt område. Hele raden er én
/// knapp som VoiceOver leser som «navn, antall steder, valgt».
struct AreaRow: View {
    let area: GuideArea
    let isSelected: Bool
    let uiLanguage: String
    let action: () -> Void

    @Environment(\.contrastColors) private var contrast

    private var placesText: String {
        L10n.string(AreaSelection.placesKey(count: area.poiCount), lang: uiLanguage)
            .replacingOccurrences(of: "%@", with: String(area.poiCount))
    }

    private var spokenLabel: String {
        var parts = [area.name, placesText]
        if isSelected { parts.append(L10n.string("area.selected", lang: uiLanguage)) }
        return parts.joined(separator: ", ")
    }

    var body: some View {
        Button(action: action) {
            HStack(spacing: AppSpacing.m) {
                VStack(alignment: .leading, spacing: AppSpacing.xs) {
                    Text(area.name)
                        .font(AppFont.cardTitle)
                        .foregroundStyle(AppColor.textPrimary)
                    Text(placesText)
                        .font(AppFont.subtitle)
                        .foregroundStyle(contrast.textSecondary)
                }
                .multilineTextAlignment(.leading)
                .fixedSize(horizontal: false, vertical: true)
                Spacer(minLength: AppSpacing.s)
                if isSelected {
                    Image(systemName: "checkmark")
                        .font(AppFont.button)
                        .foregroundStyle(AppColor.accent)
                }
            }
            .padding(.vertical, AppSpacing.xs)
            .frame(maxWidth: .infinity, minHeight: AppSpacing.minTapTarget, alignment: .leading)
            .contentShape(Rectangle())
        }
        .buttonStyle(PressableButtonStyle())
        .accessibilityLabel(Text(spokenLabel))
        .accessibilityHint(Text(hintKey))
    }

    /// Hintet leses bare på områder som ikke allerede er valgt.
    private var hintKey: LocalizedStringKey {
        isSelected ? "" : "area.selectHint"
    }
}

/// Knapp ved tittelen på Utforsk som viser området og åpner velgeren.
/// Teksten brytes i stedet for å kuttes ved store tekststørrelser.
struct AreaPill: View {
    let areaName: String?
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            HStack(spacing: AppSpacing.xs) {
                Image(systemName: "mappin.and.ellipse")
                nameText
                    .multilineTextAlignment(.leading)
                    .fixedSize(horizontal: false, vertical: true)
                Image(systemName: "chevron.down")
                    .font(.caption.weight(.semibold))
            }
            .font(AppFont.chip)
            .foregroundStyle(AppColor.textPrimary)
            .padding(.horizontal, AppSpacing.l)
            .padding(.vertical, AppSpacing.s)
            .frame(minHeight: AppSpacing.minTapTarget)
            .background(AppColor.bgOverlay, in: RoundedRectangle(cornerRadius: AppSpacing.minTapTarget / 2, style: .continuous))
            .contentShape(Rectangle())
        }
        .buttonStyle(PressableButtonStyle())
        .accessibilityLabel(Text("area.label"))
        .accessibilityValue(nameText)
        .accessibilityHint(Text("area.hint"))
    }

    private var nameText: Text {
        if let areaName { return Text(areaName) }
        return Text("area.pickerTitle")
    }
}
