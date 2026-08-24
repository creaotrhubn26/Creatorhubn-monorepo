// SessionSummarySheet.swift — oppsummering når spotting session avsluttes.

import SwiftUI

struct SessionSummarySheet: View {
    let summary: SessionSummary

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: Theme.spacingLG) {
                Text("SESSION FERDIG")
                    .font(.system(size: 10, weight: .bold))
                    .tracking(0.8)
                    .foregroundStyle(Theme.primaryBright)

                HStack(spacing: Theme.spacingSM) {
                    ValueTile(label: "Varighet", value: durationText)
                    ValueTile(label: "Bilder", value: "\(summary.photoCount)")
                }
                HStack(spacing: Theme.spacingSM) {
                    ValueTile(label: "Fly fotografert", value: "\(summary.aircraft.count)")
                    ValueTile(label: "Sjeldne", value: "\(summary.rareCount)")
                }

                if let location = summary.locationName {
                    Label(
                        summary.runway.map { "\(location) · RWY \($0)" } ?? location,
                        systemImage: "mappin.and.ellipse"
                    )
                    .font(.subheadline)
                    .foregroundStyle(Theme.textSecondary)
                }

                if !summary.aircraft.isEmpty {
                    Text("Fly i økten")
                        .font(.headline)
                        .foregroundStyle(Theme.textPrimary)
                    ForEach(summary.aircraft) { aircraft in
                        HStack {
                            VStack(alignment: .leading, spacing: 2) {
                                HStack(spacing: Theme.spacingSM) {
                                    Text(aircraft.aircraftType ?? aircraft.callsign)
                                        .font(.system(size: 15, weight: .semibold))
                                        .foregroundStyle(Theme.textPrimary)
                                    RareBadge(rarity: aircraft.rarity)
                                }
                                Text(aircraft.callsign)
                                    .font(.caption)
                                    .foregroundStyle(Theme.textSecondary)
                            }
                            Spacer()
                            Text("\(aircraft.photoCount) bilder")
                                .font(.caption)
                                .foregroundStyle(Theme.textSecondary)
                        }
                        .padding(Theme.spacingMD)
                        .background(Theme.surfaceElevated)
                        .clipShape(RoundedRectangle(cornerRadius: Theme.radiusMd))
                    }
                }
            }
            .padding(Theme.spacingLG)
        }
        .background(Theme.surface)
    }

    private var durationText: String {
        let minutes = Int(summary.duration / 60)
        return minutes >= 60 ? "\(minutes / 60)t \(minutes % 60)m" : "\(minutes)m"
    }
}
