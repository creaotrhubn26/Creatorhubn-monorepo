// POIMarker.swift
//
// Kartmarkør (5.6): sirkel 56 pt (68 for valgt/nærmeste) med bilde og
// accent-ring. Merker besøkte steder med en hake og «neste stopp» med et
// flagg (MapAccessibility.swift); begge sies også i accessibilityLabel.
// Flyttet ut av MapView.swift for å holde fila under SwiftLint-grensene.

import SwiftUI

struct POIMarker: View {
    let poi: GuidePOI
    let isHighlighted: Bool
    let distanceM: Double?
    let locale: Locale
    var status = MapMarkerStatus(isVisited: false, isNextStop: false)
    /// UI-språket for «besøkt»/«neste stopp» (kan avvike fra fortellingens).
    var uiLanguage = "nb"
    /// Gangtid (pakke 2, item 4): vist som liten pill under den fremhevede
    /// markøren (plass er for trang på de vanlige 56 pt-markørene); sagt i
    /// accessibilityLabel for alle markører uavhengig av fremhevet.
    var eta: WalkingETA?
    let action: () -> Void

    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    /// Gir nærmeste/valgte pin en varsom puls (pakke 1, punkt 4). Rent
    /// dekorativt og skjult for VoiceOver; av når «Reduser bevegelse» er på.
    @State private var pulse = false

    private var size: CGFloat { isHighlighted ? 68 : 56 }

    var body: some View {
        Button(action: action) {
            VStack(spacing: -2) {
                ZStack {
                    if isHighlighted && !reduceMotion {
                        Circle()
                            .stroke(AppColor.accent.opacity(0.5), lineWidth: 3)
                            .frame(width: size, height: size)
                            .scaleEffect(pulse ? 1.35 : 1)
                            .opacity(pulse ? 0 : 0.7)
                            .accessibilityHidden(true)
                    }
                    RemoteImage(url: poi.heroImageUrl)
                        .frame(width: size, height: size)
                        .clipShape(Circle())
                        .overlay(Circle().strokeBorder(AppColor.accent.opacity(isHighlighted ? 1 : 0.7), lineWidth: isHighlighted ? 4 : 3))
                }
                .overlay(alignment: .topTrailing) {
                    if status.isVisited { visitedBadge }
                }
                .overlay(alignment: .topLeading) {
                    if status.isNextStop { nextStopBadge }
                }
                Image(systemName: "triangle.fill")
                    .font(.system(size: 12))
                    .foregroundStyle(AppColor.accent)
                    .rotationEffect(.degrees(180))
                if isHighlighted, let eta {
                    etaPill(eta)
                }
            }
        }
        .buttonStyle(.plain)
        .accessibilityLabel(Text(markerLabel))
        .accessibilityHint(Text("map.markerHint"))
        .onAppear { startPulseIfNeeded() }
        .onChange(of: isHighlighted) { _, _ in startPulseIfNeeded() }
        .onChange(of: reduceMotion) { _, _ in startPulseIfNeeded() }
    }

    /// Hake i accent med mørk kant, så den skiller seg fra både bilde og kart.
    private var visitedBadge: some View {
        Image(systemName: "checkmark")
            .font(.system(size: 11, weight: .bold))
            .foregroundStyle(AppColor.onAccent)
            .frame(width: 22, height: 22)
            .background(AppColor.accent, in: Circle())
            .overlay(Circle().strokeBorder(AppColor.bgBase, lineWidth: 2))
            .offset(x: 4, y: -4)
            .accessibilityHidden(true)
    }

    private var nextStopBadge: some View {
        Image(systemName: "flag.fill")
            .font(.system(size: 11, weight: .bold))
            .foregroundStyle(AppColor.accent)
            .frame(width: 22, height: 22)
            .background(AppColor.bgElevated, in: Circle())
            .overlay(Circle().strokeBorder(AppColor.accent, lineWidth: 2))
            .offset(x: -4, y: -4)
            .accessibilityHidden(true)
    }

    /// Liten «6 min»-pill under den fremhevede markøren (pakke 2, item 4).
    /// Kun tallet — «å gå»/«anslag» ligger i accessibilityLabel i stedet, så
    /// den lille pillen ikke må klemme inn en hel setning.
    private func etaPill(_ eta: WalkingETA) -> some View {
        Text(L10n.shortDuration(seconds: Double(eta.minutes * 60), locale: locale))
            .font(AppFont.meta)
            .foregroundStyle(AppColor.textPrimary)
            .padding(.horizontal, AppSpacing.xs)
            .padding(.vertical, 2)
            .background(AppColor.bgElevated, in: Capsule())
            .overlay(Capsule().strokeBorder(AppColor.accent.opacity(0.6), lineWidth: 1))
            .accessibilityHidden(true)
    }

    private func startPulseIfNeeded() {
        guard isHighlighted, !reduceMotion else {
            pulse = false
            return
        }
        pulse = false
        withAnimation(.easeOut(duration: 1.4).repeatForever(autoreverses: false)) {
            pulse = true
        }
    }

    private var markerLabel: String {
        let base = status.accessibilityLabel(
            title: poi.title,
            distanceText: distanceM.map { L10n.distance(meters: $0, locale: locale) },
            localize: { L10n.string($0, lang: uiLanguage) }
        )
        guard let eta else { return base }
        let etaText = WalkingETAText.spoken(
            eta,
            localize: { L10n.string($0, lang: uiLanguage) },
            formatMinutesSpoken: { L10n.spokenDuration(seconds: Double($0 * 60), locale: locale) }
        )
        return base + ", " + etaText
    }
}
