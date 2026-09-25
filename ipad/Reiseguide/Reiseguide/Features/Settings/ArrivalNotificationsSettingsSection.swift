// ArrivalNotificationsSettingsSection.swift
//
// Bakgrunnsvarsel (pakke 2, item 2, Daniel-godkjent): opt-in, av som
// standard. To-stegs samtykke — et forklarende ark i appen (denne filen)
// FØR systemets «Alltid»-posisjon- og varslingsprompter, aldri
// systemprompten direkte fra en bryter. Teksten lover aldri automatisk
// opplesning fra en drept/kald app (se ArrivalNotificationService.swift).

import SwiftUI

struct ArrivalNotificationsSettingsSection: View {
    @Environment(AppEnvironment.self) private var env
    @Environment(\.contrastColors) private var contrast
    @State private var showExplanation = false

    var body: some View {
        Section {
            Toggle("settings.arrivalNotifications.title", isOn: toggleBinding)
                .accessibilityHint(Text("settings.arrivalNotifications.hint"))
        } footer: {
            Text("settings.arrivalNotifications.footer")
                .foregroundStyle(contrast.textSecondary)
        }
        .sheet(isPresented: $showExplanation) {
            ArrivalNotificationsExplanationSheet(
                onAllow: {
                    showExplanation = false
                    Task { await enableArrivalNotifications() }
                },
                onCancel: { showExplanation = false }
            )
        }
    }

    /// Av-slaget virker med én gang; på-slaget viser først forklaringsarket
    /// — bryteren speiler alltid den faktiske innstillingen, ikke et trykk
    /// som venter på samtykke.
    private var toggleBinding: Binding<Bool> {
        Binding(
            get: { env.settings.arrivalNotificationsEnabled },
            set: { newValue in
                if newValue {
                    showExplanation = true
                } else {
                    env.settings.arrivalNotificationsEnabled = false
                    env.location.stopMonitoringAllRegions()
                }
            }
        )
    }

    /// Steg 2 av samtykket: selve system-promptene (varsling, så «Alltid»-posisjon).
    private func enableArrivalNotifications() async {
        let notificationsGranted = await env.arrivalNotifications.requestAuthorization()
        guard notificationsGranted else { return }
        env.location.requestAlwaysAuthorization()
        env.settings.arrivalNotificationsEnabled = true
        env.updateArrivalRegions()
    }
}

/// Forklaringsarket (steg 1 av samtykket): hva funksjonen gjør, at den er
/// valgfri, og at den ikke lover avspilling uten at brukeren selv åpner
/// varselet.
struct ArrivalNotificationsExplanationSheet: View {
    let onAllow: () -> Void
    let onCancel: () -> Void

    @Environment(\.contrastColors) private var contrast

    var body: some View {
        VStack(alignment: .leading, spacing: AppSpacing.l) {
            Image(systemName: "bell.badge")
                .font(.system(size: 40))
                .foregroundStyle(AppColor.accent)
                .accessibilityHidden(true)
            Text("settings.arrivalNotifications.explanationTitle")
                .font(AppFont.screenTitle)
                .foregroundStyle(AppColor.textPrimary)
                .asHeader()
            Text("settings.arrivalNotifications.explanationBody")
                .font(AppFont.body)
                .foregroundStyle(contrast.textSecondary)
            Spacer(minLength: AppSpacing.l)
            PrimaryButton(title: "settings.arrivalNotifications.allow", action: onAllow)
            SecondaryButton(title: "action.cancel", action: onCancel)
        }
        .padding(AppSpacing.screenMargin)
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
        .background(AppColor.bgBase)
        .presentationDetents([.medium])
    }
}
