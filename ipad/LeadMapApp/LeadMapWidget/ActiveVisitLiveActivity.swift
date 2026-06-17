// ActiveVisitLiveActivity.swift
//
// WidgetKit Live Activity-rendering for 'Pågående besøk'.
// Vises på låseskjerm + Dynamic Island.

import ActivityKit
import SwiftUI
import WidgetKit

@available(iOS 16.1, *)
struct ActiveVisitLiveActivity: Widget {
    var body: some WidgetConfiguration {
        ActivityConfiguration(for: ActiveVisitAttributes.self) { context in
            // Låseskjerm-view
            HStack(spacing: 12) {
                Image(systemName: "doc.text.viewfinder")
                    .font(.title2)
                    .foregroundStyle(Color(red: 0.75, green: 0.52, blue: 0.99))
                VStack(alignment: .leading, spacing: 2) {
                    Text(context.attributes.leadName)
                        .font(.headline)
                    if let addr = context.attributes.leadAddress {
                        Text(addr)
                            .font(.caption)
                            .foregroundStyle(.secondary)
                            .lineLimit(1)
                    }
                    Text("Pågående besøk · \(formatElapsed(context.state.elapsedSeconds))")
                        .font(.caption2)
                        .foregroundStyle(.secondary)
                }
                Spacer()
                Text("\(formatElapsed(context.state.elapsedSeconds))")
                    .font(.title3.monospacedDigit().bold())
                    .foregroundStyle(.primary)
            }
            .padding()
            .activityBackgroundTint(Color.black.opacity(0.4))
        } dynamicIsland: { context in
            DynamicIsland {
                DynamicIslandExpandedRegion(.leading) {
                    Image(systemName: "doc.text.viewfinder")
                        .foregroundStyle(Color(red: 0.75, green: 0.52, blue: 0.99))
                }
                DynamicIslandExpandedRegion(.trailing) {
                    Text(formatElapsed(context.state.elapsedSeconds))
                        .font(.body.monospacedDigit().bold())
                }
                DynamicIslandExpandedRegion(.center) {
                    VStack {
                        Text(context.attributes.leadName)
                            .font(.subheadline.bold())
                        if let addr = context.attributes.leadAddress {
                            Text(addr).font(.caption).foregroundStyle(.secondary)
                        }
                    }
                }
                DynamicIslandExpandedRegion(.bottom) {
                    Text(context.state.statusLabel).font(.caption2)
                }
            } compactLeading: {
                Image(systemName: "doc.text.viewfinder")
                    .foregroundStyle(Color(red: 0.75, green: 0.52, blue: 0.99))
            } compactTrailing: {
                Text(formatElapsed(context.state.elapsedSeconds))
                    .font(.caption.monospacedDigit())
            } minimal: {
                Image(systemName: "doc.text.viewfinder")
                    .foregroundStyle(Color(red: 0.75, green: 0.52, blue: 0.99))
            }
        }
    }
}

@available(iOS 16.1, *)
private func formatElapsed(_ seconds: Int) -> String {
    let h = seconds / 3600
    let m = (seconds % 3600) / 60
    if h > 0 {
        return String(format: "%d:%02d", h, m)
    }
    return String(format: "%d min", m)
}
