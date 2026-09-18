// Chips.swift
//
// Filter-chips (5.5), språkvelger-pille (5.1) og søkefelt (5.2).

import SwiftUI

struct FilterChip: View {
    let label: String
    let isSelected: Bool
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            Text(label)
                .font(AppFont.chip)
                .fontWeight(isSelected ? .semibold : .medium)
                .foregroundStyle(isSelected ? AppColor.onAccent : AppColor.textPrimary)
                .padding(.horizontal, AppSpacing.l)
                .frame(minHeight: 40)
                .background(isSelected ? AppColor.accent : AppColor.bgElevated, in: Capsule())
                .minTapTarget()
        }
        .buttonStyle(PressableButtonStyle())
        .accessibilityAddTraits(isSelected ? [.isButton, .isSelected] : .isButton)
    }
}

/// Horisontal rad med chips. Kategoriene kommer fra backend; «Alle» legges
/// til av visningen.
struct FilterChipRow: View {
    let items: [(id: String?, label: String)]
    @Binding var selectedId: String?

    var body: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: AppSpacing.s) {
                ForEach(Array(items.enumerated()), id: \.offset) { _, item in
                    FilterChip(label: item.label, isSelected: item.id == selectedId) {
                        selectedId = item.id
                    }
                }
            }
            .padding(.horizontal, AppSpacing.screenMargin)
        }
        .accessibilityElement(children: .contain)
        .accessibilityLabel(Text("filter.label"))
    }
}

struct LanguagePill: View {
    let languageName: String
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            HStack(spacing: AppSpacing.xs) {
                Image(systemName: "globe")
                Text(languageName)
                    .lineLimit(1)
                Image(systemName: "chevron.down")
                    .font(.caption.weight(.semibold))
            }
            .font(AppFont.chip)
            .foregroundStyle(AppColor.textPrimary)
            .padding(.horizontal, AppSpacing.l)
            .frame(minHeight: 40)
            .background(AppColor.bgOverlay, in: Capsule())
            .minTapTarget()
        }
        .buttonStyle(PressableButtonStyle())
        .accessibilityLabel(Text("language.label"))
        .accessibilityValue(Text(languageName))
    }
}

struct SearchField: View {
    let placeholder: LocalizedStringKey
    @Binding var text: String
    var onSubmit: () -> Void = {}

    var body: some View {
        HStack(spacing: AppSpacing.s) {
            Image(systemName: "magnifyingglass")
                .foregroundStyle(AppColor.textSecondary)
            ZStack(alignment: .leading) {
                if text.isEmpty {
                    Text(placeholder)
                        .foregroundStyle(AppColor.textPlaceholder)
                        .accessibilityHidden(true)
                }
                TextField("", text: $text)
                    .foregroundStyle(AppColor.textPrimary)
                    .submitLabel(.search)
                    .onSubmit(onSubmit)
                    .accessibilityLabel(Text(placeholder))
            }
            if !text.isEmpty {
                Button {
                    text = ""
                } label: {
                    Image(systemName: "xmark.circle.fill")
                        .foregroundStyle(AppColor.textSecondary)
                        .minTapTarget()
                }
                .accessibilityLabel(Text("search.clear"))
            }
        }
        .font(AppFont.body)
        .padding(.horizontal, AppSpacing.l)
        .frame(minHeight: 52)
        .background(AppColor.bgElevated, in: Capsule())
    }
}
