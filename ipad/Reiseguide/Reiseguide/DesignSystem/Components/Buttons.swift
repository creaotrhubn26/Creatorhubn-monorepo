// Buttons.swift
//
// Primærknapp (5.3), sekundærknapp (5.4) og runde ikonknapper over bilde (5.10).

import SwiftUI

struct PrimaryButton: View {
    let title: LocalizedStringKey
    var systemImage: String?
    var isLoading = false
    var isEnabled = true
    var disabledHint: LocalizedStringKey?
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            HStack(spacing: AppSpacing.s) {
                if isLoading {
                    ProgressView().tint(AppColor.onAccent)
                } else if let systemImage {
                    Image(systemName: systemImage)
                }
                Text(title)
            }
            .font(AppFont.button)
            .foregroundStyle(isEnabled ? AppColor.onAccent : AppColor.textTertiary)
            .frame(maxWidth: .infinity, minHeight: 56)
            .background(isEnabled ? AppColor.accent : AppColor.bgElevated, in: Capsule())
            .contentShape(Capsule())
        }
        .buttonStyle(PressableButtonStyle())
        .disabled(!isEnabled || isLoading)
        .accessibilityHint(isEnabled ? Text("") : Text(disabledHint ?? ""))
    }
}

struct SecondaryButton: View {
    let title: LocalizedStringKey
    var systemImage: String?
    var isSelected = false
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            HStack(spacing: AppSpacing.s) {
                if let systemImage {
                    Image(systemName: systemImage)
                        .foregroundStyle(isSelected ? AppColor.accent : AppColor.textPrimary)
                }
                Text(title)
            }
            .font(AppFont.button)
            .foregroundStyle(AppColor.textPrimary)
            .frame(maxWidth: .infinity, minHeight: 56)
            .overlay(Capsule().strokeBorder(AppColor.borderStrong, lineWidth: 1.5))
            .contentShape(Capsule())
        }
        .buttonStyle(PressableButtonStyle())
    }
}

/// Sirkel 44 pt, fyll bgOverlay, ikon 20 pt textPrimary (5.10).
struct IconCircleButton: View {
    let systemImage: String
    let label: LocalizedStringKey
    var tint: Color = AppColor.textPrimary
    var size: CGFloat = 44
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            Image(systemName: systemImage)
                .font(.system(size: 20, weight: .semibold))
                .foregroundStyle(tint)
                .frame(width: size, height: size)
                .background(AppColor.bgOverlay, in: Circle())
                .contentShape(Circle())
        }
        .buttonStyle(PressableButtonStyle())
        .accessibilityLabel(Text(label))
    }
}

/// Trykket tilstand: 85 % lysstyrke (5.3).
struct PressableButtonStyle: ButtonStyle {
    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .brightness(configuration.isPressed ? -0.15 : 0)
    }
}
