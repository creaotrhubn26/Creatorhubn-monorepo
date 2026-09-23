// PlayerLiveActivityWidget.swift
//
// Live Activity for «Nå spilles» (pakke 2, item 6): låseskjerm + Dynamic
// Island. Alle tekster i ContentState er allerede lokalisert av hovedappen
// (Core/PlayerActivityManager.swift) — dette target-et har ikke
// L10n/appens .lproj-bundle, se project.yml (ReiseguideWidgets.sources).
//
// Fargene er hentet fra hovedappens Assets.xcassets (AppColor) som faste
// RGB-verdier i stedet for `Color("navn")`: widget-extension-target-et har
// sin egen ressursbundle og deler ikke appens asset-katalog.

import ActivityKit
import SwiftUI
import WidgetKit

private enum ActivityPalette {
    static let background = Color(red: 0x0B / 255.0, green: 0x10 / 255.0, blue: 0x16 / 255.0)
    static let surface = Color(red: 0x15 / 255.0, green: 0x1C / 255.0, blue: 0x24 / 255.0)
    static let accent = Color(red: 0xE6 / 255.0, green: 0xD3 / 255.0, blue: 0xAE / 255.0)
    static let textPrimary = Color(red: 0xF5 / 255.0, green: 0xF3 / 255.0, blue: 0xEE / 255.0)
    static let textSecondary = Color(red: 0xA9 / 255.0, green: 0xB0 / 255.0, blue: 0xBA / 255.0)
}

@available(iOS 16.1, *)
struct PlayerLiveActivityWidget: Widget {
    var body: some WidgetConfiguration {
        ActivityConfiguration(for: PlayerActivityAttributes.self) { context in
            PlayerActivityLockScreenView(attributes: context.attributes, state: context.state)
                .activityBackgroundTint(ActivityPalette.background)
                .activitySystemActionForegroundColor(ActivityPalette.textPrimary)
        } dynamicIsland: { context in
            DynamicIsland {
                DynamicIslandExpandedRegion(.leading) {
                    Image(systemName: "headphones")
                        .foregroundStyle(ActivityPalette.accent)
                        .accessibilityHidden(true)
                }
                DynamicIslandExpandedRegion(.trailing) {
                    Image(systemName: context.state.isPlaying ? "pause.fill" : "play.fill")
                        .foregroundStyle(ActivityPalette.textPrimary)
                        .accessibilityHidden(true)
                }
                DynamicIslandExpandedRegion(.center) {
                    VStack(alignment: .leading, spacing: 2) {
                        Text(context.attributes.poiTitle)
                            .font(.subheadline.bold())
                            .foregroundStyle(ActivityPalette.textPrimary)
                            .lineLimit(1)
                        if let chapterTitle = context.state.chapterTitle {
                            Text(chapterTitle)
                                .font(.caption)
                                .foregroundStyle(ActivityPalette.textSecondary)
                                .lineLimit(1)
                        }
                    }
                    // Synlig tekst, ikke skjult: VoiceOver leser den naturlig
                    // sammen med resten av det utvidede Dynamic Island-innholdet.
                }
                DynamicIslandExpandedRegion(.bottom) {
                    VStack(alignment: .leading, spacing: 4) {
                        PlayerActivityProgressView(state: context.state)
                        HStack(spacing: 6) {
                            Text(context.state.chapterProgressText)
                            if let distanceText = context.state.distanceText {
                                Text("·")
                                Text(distanceText)
                            }
                        }
                        .font(.caption2)
                        .foregroundStyle(ActivityPalette.textSecondary)
                    }
                }
            } compactLeading: {
                Image(systemName: "headphones")
                    .foregroundStyle(ActivityPalette.accent)
                    .accessibilityHidden(true)
            } compactTrailing: {
                Image(systemName: context.state.isPlaying ? "pause.fill" : "play.fill")
                    .foregroundStyle(ActivityPalette.textPrimary)
                    .accessibilityLabel(Text(context.state.statusText))
            } minimal: {
                Image(systemName: "headphones")
                    .foregroundStyle(ActivityPalette.accent)
                    .accessibilityHidden(true)
            }
            .widgetURL(nil)
            .keylineTint(ActivityPalette.accent)
        }
    }
}

/// Låseskjerm-visningen: tittel, kapittel, fremdrift og avstand til neste
/// stopp. Ett accessibility-element med full oppsummering — teksten i
/// bildet er ellers begrenset til én linje for å få plass på låseskjermen.
@available(iOS 16.1, *)
struct PlayerActivityLockScreenView: View {
    let attributes: PlayerActivityAttributes
    let state: PlayerActivityAttributes.ContentState

    var body: some View {
        HStack(alignment: .center, spacing: 12) {
            Image(systemName: "headphones")
                .font(.title2)
                .foregroundStyle(ActivityPalette.accent)
                .frame(width: 40, height: 40)
                .background(ActivityPalette.surface, in: Circle())
                .accessibilityHidden(true)

            VStack(alignment: .leading, spacing: 4) {
                Text(attributes.poiTitle)
                    .font(.headline)
                    .foregroundStyle(ActivityPalette.textPrimary)
                    .lineLimit(1)
                if let chapterTitle = state.chapterTitle {
                    Text(chapterTitle)
                        .font(.subheadline)
                        .foregroundStyle(ActivityPalette.textSecondary)
                        .lineLimit(1)
                }
                PlayerActivityProgressView(state: state)
                    .padding(.top, 2)
                HStack(spacing: 6) {
                    Text(state.chapterProgressText)
                    if let distanceText = state.distanceText {
                        Text("·")
                        Text(distanceText)
                    }
                }
                .font(.caption)
                .foregroundStyle(ActivityPalette.textSecondary)
            }

            Spacer(minLength: 0)

            Image(systemName: state.isPlaying ? "pause.circle.fill" : "play.circle.fill")
                .font(.system(size: 32))
                .foregroundStyle(ActivityPalette.accent)
                .accessibilityHidden(true)
        }
        .padding(16)
        .accessibilityElement(children: .ignore)
        .accessibilityLabel(Text(state.accessibilitySummary))
    }
}

/// Fremdriftslinje: `ProgressView(timerInterval:)` mens fortellingen
/// spiller, så systemet animerer selv uten at appen må sende nye
/// oppdateringer hvert sekund; statisk verdi når den er pauset.
@available(iOS 16.1, *)
struct PlayerActivityProgressView: View {
    let state: PlayerActivityAttributes.ContentState

    var body: some View {
        if state.isPlaying, state.playbackRangeStart < state.playbackRangeEnd {
            ProgressView(timerInterval: state.playbackRangeStart ... state.playbackRangeEnd, countsDown: false)
                .tint(ActivityPalette.accent)
        } else {
            ProgressView(value: state.pausedProgress)
                .tint(ActivityPalette.accent)
        }
    }
}
