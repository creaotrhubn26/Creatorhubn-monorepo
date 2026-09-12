// ShootLiveActivity.swift
//
// Live Activity-UI for «shoot i gang»: låseskjerm-banner + Dynamic Island.
// Bor i widget-extensionen. Deler ShootActivityAttributes med app-target.

import WidgetKit
import SwiftUI
import ActivityKit

@available(iOS 16.1, *)
struct ShootLiveActivity: Widget {
    var body: some WidgetConfiguration {
        ActivityConfiguration(for: ShootActivityAttributes.self) { context in
            // Låseskjerm / banner
            HStack(spacing: 12) {
                Image(systemName: context.state.tethered ? "camera.fill" : "camera")
                    .font(.title2)
                    .foregroundStyle(.purple)
                VStack(alignment: .leading, spacing: 2) {
                    Text(context.attributes.sessionName)
                        .font(.headline)
                        .lineLimit(1)
                    Text("\(context.state.shotCount) bilder · startet \(context.attributes.startedAt, style: .time)")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }
                Spacer()
                Text("\(context.state.shotCount)")
                    .font(.title.bold())
                    .foregroundStyle(.purple)
            }
            .padding()
            .activityBackgroundTint(Color.black.opacity(0.6))
        } dynamicIsland: { context in
            DynamicIsland {
                DynamicIslandExpandedRegion(.leading) {
                    Label(context.attributes.sessionName, systemImage: "camera.fill")
                        .font(.caption)
                }
                DynamicIslandExpandedRegion(.trailing) {
                    Text("\(context.state.shotCount)")
                        .font(.headline)
                }
                DynamicIslandExpandedRegion(.bottom) {
                    if let file = context.state.lastFilename {
                        Text("Siste: \(file)").font(.caption2).foregroundStyle(.secondary)
                    }
                }
            } compactLeading: {
                Image(systemName: "camera.fill").foregroundStyle(.purple)
            } compactTrailing: {
                Text("\(context.state.shotCount)")
            } minimal: {
                Image(systemName: "camera.fill").foregroundStyle(.purple)
            }
        }
    }
}
