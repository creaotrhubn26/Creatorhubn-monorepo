// TerritoryBanner.swift
//
// Mykt banner øverst på MapScreen når selgeren er fysisk utenfor sin grid.
// Drives av on-device-sjekken i TerritoryMonitor (umiddelbar, offline).
// Følger stilen til RemindersBanner.

import SwiftUI

struct TerritoryBanner: View {
    var body: some View {
        let monitor = TerritoryMonitor.shared
        if monitor.isEnforced && monitor.isOutsideGrid {
            HStack(spacing: 12) {
                Image(systemName: "location.slash.fill")
                    .font(.title3)
                    .foregroundStyle(.orange)

                VStack(alignment: .leading, spacing: 2) {
                    Text("Du er utenfor din sone")
                        .font(.subheadline.bold())
                    Text("Sjekk med teamleder før du følger opp leads her.")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }

                Spacer()

                Image(systemName: "exclamationmark.triangle.fill")
                    .font(.caption)
                    .foregroundStyle(.orange)
            }
            .padding(12)
            .background(Color.orange.opacity(0.08), in: RoundedRectangle(cornerRadius: 12))
            .overlay(
                RoundedRectangle(cornerRadius: 12)
                    .stroke(Color.orange.opacity(0.4), lineWidth: 1)
            )
            .padding(.horizontal, 12)
        }
    }
}
