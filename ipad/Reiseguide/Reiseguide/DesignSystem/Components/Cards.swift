// Cards.swift
//
// Nærmeste-kort (5.7), destinasjonsflis (5.17), synstolkingskort (5.15),
// tekstingsvisning (5.16), ikonrad (5.12) og scrim over bilder (del 2).

import SwiftUI

/// Lineær gradient bgBase 0 % → 92 % som starter 35 % ned i bildet.
struct ScrimOverlay: View {
    var body: some View {
        LinearGradient(
            stops: [
                .init(color: AppColor.bgBase.opacity(0), location: 0),
                .init(color: AppColor.bgBase.opacity(0), location: 0.35),
                .init(color: AppColor.bgBase.opacity(0.92), location: 1)
            ],
            startPoint: .top,
            endPoint: .bottom
        )
        .allowsHitTesting(false)
    }
}

/// Bilde fra URL med bgSurface som plassholder. Foto får
/// accessibilityIgnoresInvertColors (Smart Invert, 8.6).
struct RemoteImage: View {
    let url: String?
    var contentMode: ContentMode = .fill

    var body: some View {
        Group {
            if let url, let parsed = URL(string: url) {
                AsyncImage(url: parsed) { phase in
                    switch phase {
                    case let .success(image):
                        image.resizable().aspectRatio(contentMode: contentMode)
                    default:
                        placeholder
                    }
                }
            } else {
                placeholder
            }
        }
        .accessibilityIgnoresInvertColors()
    }

    private var placeholder: some View {
        ZStack {
            AppColor.bgSurface
            Image(systemName: "photo")
                .font(.title2)
                .foregroundStyle(AppColor.textTertiary)
        }
    }
}

struct NearbyCard: View {
    let poi: GuidePOI
    let distanceM: Double?
    let isLocked: Bool
    let locale: Locale
    /// Liten etikett under tittelen, f.eks. «Samme kategori» i tipsene.
    var badge: String?
    let action: () -> Void

    @Environment(\.contrastColors) private var contrast

    var body: some View {
        Button(action: action) {
            HStack(spacing: AppSpacing.m) {
                RemoteImage(url: poi.heroImageUrl)
                    .frame(width: 80, height: 80)
                    .clipShape(RoundedRectangle(cornerRadius: AppRadius.tile, style: .continuous))
                VStack(alignment: .leading, spacing: AppSpacing.xs) {
                    HStack(spacing: AppSpacing.xs) {
                        if isLocked {
                            Image(systemName: "lock.fill").foregroundStyle(AppColor.accent)
                        }
                        Text(poi.title)
                            .font(AppFont.cardTitle)
                            .foregroundStyle(AppColor.textPrimary)
                            .lineLimit(3)
                    }
                    if let distanceM {
                        Label(L10n.distance(meters: distanceM, locale: locale), systemImage: "mappin")
                            .font(AppFont.subtitle)
                            .foregroundStyle(contrast.textSecondary)
                    } else if let location = poi.locationLabel {
                        Label(location, systemImage: "mappin")
                            .font(AppFont.subtitle)
                            .foregroundStyle(contrast.textSecondary)
                    }
                    if let rating = poi.rating {
                        HStack(spacing: AppSpacing.xs) {
                            Image(systemName: "star.fill").foregroundStyle(AppColor.rating)
                            Text(rating.average, format: .number.precision(.fractionLength(1)))
                                .foregroundStyle(AppColor.textPrimary)
                            Text("(\(rating.count.formatted(.number.locale(locale))))")
                                .foregroundStyle(contrast.textSecondary)
                        }
                        .font(AppFont.subtitle)
                    }
                    if let badge {
                        Text(badge)
                            .font(AppFont.iconLabel)
                            .foregroundStyle(AppColor.accentMuted)
                    }
                }
                Spacer(minLength: 0)
                Image(systemName: "chevron.right")
                    .foregroundStyle(contrast.textSecondary)
            }
            .padding(AppSpacing.m)
            .frame(maxWidth: .infinity, minHeight: 104, alignment: .leading)
            .background(AppColor.bgSurface, in: RoundedRectangle(cornerRadius: AppRadius.card, style: .continuous))
            .overlay(RoundedRectangle(cornerRadius: AppRadius.card, style: .continuous).strokeBorder(contrast.border, lineWidth: 1))
            .contentShape(RoundedRectangle(cornerRadius: AppRadius.card, style: .continuous))
        }
        .buttonStyle(PressableButtonStyle())
        .accessibilityElement(children: .ignore)
        .accessibilityLabel(Text(accessibilityText))
        .accessibilityAddTraits(.isButton)
    }

    private var accessibilityText: String {
        var parts: [String] = [poi.title]
        if isLocked { parts.append(L10n.string("poi.locked", lang: locale.identifier)) }
        if let distanceM {
            parts.append(L10n.string("distance.away", lang: locale.identifier)
                .replacingOccurrences(of: "%@", with: L10n.distance(meters: distanceM, locale: locale)))
        }
        if let rating = poi.rating {
            parts.append(L10n.string("rating.spoken", lang: locale.identifier)
                .replacingOccurrences(of: "%1$@", with: rating.average.formatted(.number.precision(.fractionLength(1)).locale(locale)))
                .replacingOccurrences(of: "%2$@", with: rating.count.formatted(.number.locale(locale))))
        }
        if let badge { parts.append(badge) }
        return parts.joined(separator: ", ")
    }
}

struct DestinationTile: View {
    let poi: GuidePOI
    let action: () -> Void

    /// 104 pt ved standard tekststørrelse; vokser med Dynamic Type så
    /// tittelen får plass uten å krympes.
    @ScaledMetric(relativeTo: .headline) private var tileSize: CGFloat = 104

    var body: some View {
        Button(action: action) {
            ZStack(alignment: .bottomLeading) {
                RemoteImage(url: poi.heroImageUrl)
                ScrimOverlay()
                Text(poi.title)
                    .font(AppFont.cardTitle)
                    .foregroundStyle(AppColor.textPrimary)
                    .lineLimit(3)
                    .padding(AppSpacing.m)
            }
            .frame(width: tileSize, height: tileSize)
            .clipShape(RoundedRectangle(cornerRadius: AppRadius.tile, style: .continuous))
        }
        .buttonStyle(PressableButtonStyle())
        .accessibilityLabel(Text(poi.title))
    }
}

/// Fire fakta om opplevelsen. Kun informasjon; hele raden er ett
/// accessibility-element. Bytter til vertikal layout fra accessibility1.
struct InfoIconRow: View {
    let durationText: String?
    let hasAudio: Bool
    let hasCaptions: Bool
    let hasAudioDescription: Bool
    let spokenSummary: String

    @Environment(\.dynamicTypeSize) private var dynamicTypeSize
    @Environment(\.contrastColors) private var contrast
    /// Sirkelen rundt ikonet: 48 pt ved standard tekststørrelse.
    @ScaledMetric(relativeTo: .title3) private var iconCircle: CGFloat = 48

    private struct Item {
        let icon: String
        let label: LocalizedStringKey
        let text: String?
        let present: Bool
    }

    private var items: [Item] {
        [
            Item(icon: "clock", label: "info.duration", text: durationText, present: durationText != nil),
            Item(icon: "speaker.wave.2", label: "info.audio", text: nil, present: hasAudio),
            Item(icon: "text.alignleft", label: "info.captions", text: nil, present: hasCaptions),
            Item(icon: "eye", label: "info.audioDescription", text: nil, present: hasAudioDescription)
        ]
    }

    var body: some View {
        Group {
            if dynamicTypeSize.isAccessibilitySize {
                VStack(alignment: .leading, spacing: AppSpacing.m) {
                    ForEach(Array(items.enumerated()), id: \.offset) { _, item in
                        HStack(spacing: AppSpacing.m) {
                            icon(item.icon)
                            label(item)
                        }
                    }
                }
            } else {
                HStack(alignment: .top) {
                    ForEach(Array(items.enumerated()), id: \.offset) { _, item in
                        VStack(spacing: AppSpacing.s) {
                            icon(item.icon)
                            label(item)
                        }
                        .frame(maxWidth: .infinity)
                    }
                }
            }
        }
        .accessibilityElement(children: .ignore)
        .accessibilityLabel(Text(spokenSummary))
    }

    private func icon(_ name: String) -> some View {
        Image(systemName: name)
            .font(.title3.weight(.medium))
            .foregroundStyle(AppColor.textPrimary)
            .frame(width: iconCircle, height: iconCircle)
            .overlay(Circle().strokeBorder(AppColor.borderStrong, lineWidth: 1))
    }

    private func label(_ item: Item) -> some View {
        Group {
            if let text = item.text {
                Text(text)
            } else {
                Text(item.label)
            }
        }
        .font(AppFont.iconLabel)
        .foregroundStyle(item.present ? contrast.textSecondary : contrast.textTertiary)
        .strikethrough(!item.present)
        .multilineTextAlignment(.center)
    }
}

/// Synstolkingskort (5.15). Statisk element; leses på forespørsel (8.4, punkt 2).
struct AudioDescriptionCard: View {
    let statusText: LocalizedStringKey
    let text: String
    let imageUrl: String?
    @Binding var isExpanded: Bool

    @Environment(\.contrastColors) private var contrast

    var body: some View {
        VStack(alignment: .leading, spacing: AppSpacing.m) {
            HStack(spacing: AppSpacing.m) {
                RemoteImage(url: imageUrl)
                    .frame(width: 56, height: 56)
                    .clipShape(RoundedRectangle(cornerRadius: AppRadius.tile, style: .continuous))
                    .accessibilityHidden(true)
                VStack(alignment: .leading, spacing: 2) {
                    Text(statusText)
                        .font(.caption)
                        .foregroundStyle(contrast.textSecondary)
                    Text("audioDescription.title")
                        .font(AppFont.cardTitle)
                        .foregroundStyle(AppColor.textPrimary)
                }
            }
            Text(text)
                .font(AppFont.body)
                .foregroundStyle(AppColor.textPrimary)
                .lineLimit(isExpanded ? nil : 3)
                .truncationMode(.tail)
            Button {
                isExpanded.toggle()
            } label: {
                HStack {
                    Text(isExpanded ? "audioDescription.less" : "audioDescription.more")
                    Spacer()
                    Image(systemName: isExpanded ? "chevron.up" : "chevron.right")
                }
                .font(AppFont.chip)
                .foregroundStyle(AppColor.textPrimary)
                .padding(.horizontal, AppSpacing.l)
                .frame(maxWidth: .infinity, minHeight: 48)
                .background(AppColor.bgElevated, in: Capsule())
            }
            .buttonStyle(PressableButtonStyle())
        }
        .padding(AppSpacing.l)
        .background(AppColor.bgSurface, in: RoundedRectangle(cornerRadius: AppRadius.card, style: .continuous))
        .overlay(RoundedRectangle(cornerRadius: AppRadius.card, style: .continuous).strokeBorder(contrast.border, lineWidth: 1))
        .accessibilityElement(children: .contain)
        .accessibilityLabel(Text("audioDescription.title"))
        .accessibilityValue(Text(text))
    }
}

/// Tekstingsvisning (5.16): gjeldende cue, 2 linjer høyt, sentrert.
struct CaptionView: View {
    let text: String?

    var body: some View {
        Text(text ?? " ")
            .font(AppFont.body)
            .foregroundStyle(AppColor.textPrimary)
            .multilineTextAlignment(.center)
            .frame(maxWidth: .infinity, minHeight: 56)
            .padding(.horizontal, AppSpacing.l)
            .background(AppColor.bgSurface.opacity(0.6), in: RoundedRectangle(cornerRadius: AppRadius.tile, style: .continuous))
            .accessibilityLabel(Text("captions.label"))
            .accessibilityValue(Text(text ?? ""))
    }
}
