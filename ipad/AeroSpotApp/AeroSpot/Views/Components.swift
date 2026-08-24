// Components.swift — gjenbrukbare AeroSpot-views: badges, tiles,
// score-bars, states.

import SwiftUI
import UIKit

struct RareBadge: View {
    let rarity: Rarity

    var body: some View {
        if rarity != .common {
            Text(rarity.label)
                .font(.system(size: 10, weight: .bold))
                .tracking(0.6)
                .foregroundStyle(Theme.background)
                .padding(.horizontal, Theme.spacingSM)
                .padding(.vertical, 2)
                .background(color)
                .clipShape(Capsule())
        }
    }

    private var color: Color {
        switch rarity {
        case .common: return Theme.textTertiary
        case .uncommon: return Theme.primaryBright
        case .rare: return Theme.warning
        case .veryRare: return Color(hex: 0xFF8A3D)
        case .legendary: return Theme.gold
        }
    }
}

struct MilitaryBadge: View {
    var body: some View {
        Text("MILITÆR")
            .font(.system(size: 10, weight: .bold))
            .tracking(0.6)
            .foregroundStyle(.white)
            .padding(.horizontal, Theme.spacingSM)
            .padding(.vertical, 2)
            .background(Color(hex: 0x4B7A3A))
            .clipShape(Capsule())
    }
}

struct RunwayBadge: View {
    let runway: String

    var body: some View {
        Text(runway)
            .font(.system(size: 17, weight: .bold, design: .rounded))
            .foregroundStyle(Theme.primaryBright)
            .padding(.horizontal, Theme.spacingSM)
            .padding(.vertical, 2)
            .background(Theme.primary.opacity(0.14))
            .clipShape(RoundedRectangle(cornerRadius: Theme.radiusSm))
    }
}

struct ValueTile: View {
    let label: String
    let value: String

    var body: some View {
        VStack(alignment: .leading, spacing: 2) {
            Text(label.uppercased())
                .font(.system(size: 10, weight: .semibold))
                .tracking(0.6)
                .foregroundStyle(Theme.textSecondary)
            Text(value)
                .font(.system(size: 16, weight: .semibold))
                .foregroundStyle(Theme.textPrimary)
                .lineLimit(1)
                .minimumScaleFactor(0.7)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(Theme.spacingMD)
        .background(Theme.surfaceElevated)
        .clipShape(RoundedRectangle(cornerRadius: Theme.radiusMd))
    }
}

/// Bilde-slot: viser asset hvis den finnes i Assets.xcassets, ellers
/// gradient-placeholder med flysilhuett. Legg inn ekte bilder med samme
/// navn (f.eks. "hero-spotting", "viewfinder-aircraft", "tips-photo") —
/// ingen kodeendring nødvendig.
struct PhotoPlaceholder: View {
    let assetName: String
    var height: CGFloat = 160
    var symbol: String = "airplane"

    var body: some View {
        Group {
            if UIImage(named: assetName) != nil {
                Image(assetName)
                    .resizable()
                    .scaledToFill()
            } else {
                LinearGradient(
                    colors: [Color(hex: 0x16283E), Color(hex: 0x0A1522)],
                    startPoint: .topLeading,
                    endPoint: .bottomTrailing
                )
                .overlay(
                    Image(systemName: symbol)
                        .font(.system(size: 44, weight: .light))
                        .foregroundStyle(Theme.primaryBright.opacity(0.45))
                )
            }
        }
        .frame(height: height)
        .frame(maxWidth: .infinity)
        .clipShape(RoundedRectangle(cornerRadius: Theme.radiusMd))
    }
}

/// Tile med SF-ikon, label, verdi og undertekst (mockup-stil)
struct IconTile: View {
    let icon: String
    let label: String
    let value: String
    var subtitle: String = ""

    var body: some View {
        VStack(alignment: .leading, spacing: 3) {
            HStack(spacing: 4) {
                Image(systemName: icon)
                    .font(.system(size: 11))
                    .foregroundStyle(Theme.primaryBright)
                Text(label.uppercased())
                    .font(.system(size: 9, weight: .semibold))
                    .tracking(0.5)
                    .foregroundStyle(Theme.textSecondary)
            }
            Text(value)
                .font(.system(size: 16, weight: .semibold))
                .foregroundStyle(Theme.textPrimary)
                .lineLimit(1)
                .minimumScaleFactor(0.7)
            if !subtitle.isEmpty {
                Text(subtitle)
                    .font(.system(size: 10))
                    .foregroundStyle(Theme.textTertiary)
                    .lineLimit(1)
                    .minimumScaleFactor(0.8)
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(Theme.spacingMD)
        .background(Theme.surfaceElevated)
        .clipShape(RoundedRectangle(cornerRadius: Theme.radiusMd))
    }
}

struct ScoreBar: View {
    let label: String
    let value: Int

    var body: some View {
        HStack(spacing: Theme.spacingMD) {
            Text(label)
                .font(.caption)
                .foregroundStyle(Theme.textSecondary)
                .frame(width: 60, alignment: .leading)
            GeometryReader { geo in
                ZStack(alignment: .leading) {
                    Capsule().fill(Theme.surfaceElevated)
                    Capsule()
                        .fill(color)
                        .frame(width: geo.size.width * Double(value) / 100)
                }
            }
            .frame(height: 6)
            Text("\(value)")
                .font(.caption.weight(.semibold))
                .foregroundStyle(Theme.textPrimary)
                .frame(width: 28, alignment: .trailing)
        }
    }

    private var color: Color {
        if value >= 80 { return Theme.success }
        if value >= 55 { return Theme.warning }
        return Theme.danger
    }
}

struct EmptyStateView: View {
    let title: String
    var message: String?

    var body: some View {
        VStack(spacing: Theme.spacingSM) {
            Text(title)
                .font(.headline)
                .foregroundStyle(Theme.textPrimary)
            if let message {
                Text(message)
                    .font(.subheadline)
                    .foregroundStyle(Theme.textSecondary)
                    .multilineTextAlignment(.center)
            }
        }
        .frame(maxWidth: .infinity)
        .padding(Theme.spacingXL)
    }
}

func formatTime(_ date: Date?) -> String {
    guard let date else { return "–" }
    return date.formatted(date: .omitted, time: .shortened)
}

func formatTimeIso(_ iso: String?) -> String {
    guard let iso, let date = ISO8601DateFormatter().date(from: iso) else { return "–" }
    return formatTime(date)
}
