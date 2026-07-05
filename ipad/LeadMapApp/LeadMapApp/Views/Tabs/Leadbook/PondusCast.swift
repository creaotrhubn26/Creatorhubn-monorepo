// PondusCast.swift — alle portrett-bildene og deres roller (2026-06-30)
//
// Sentralisert mapping fra navn → bilde-asset slik at vi kan bytte/utvide enkelt.

import SwiftUI

enum PondusCast: String, CaseIterable {
    case marit, lars, helena, sofie, espen, aaron

    /// Asset-navnet i Assets.xcassets
    var assetName: String {
        switch self {
        case .marit:  return "portrait-marit"
        case .lars:   return "portrait-lars"
        case .helena: return "portrait-helena"
        case .sofie:  return "portrait-sofie"
        case .espen:  return "portrait-espen"
        case .aaron:  return "portrait-aaron"
        }
    }

    var displayName: String {
        switch self {
        case .marit:  return "Marit Hansen"
        case .lars:   return "Lars Kristensen"
        case .helena: return "Helena Bjørnson"
        case .sofie:  return "Sofie Vik"
        case .espen:  return "Espen Bråten"
        case .aaron:  return "Aaron Lin"
        }
    }

    var initials: String {
        let parts = displayName.split(separator: " ")
        return parts.prefix(2).map { String($0.first!) }.joined()
    }

    var role: String {
        switch self {
        case .marit:  return "Pondus-coach"
        case .lars:   return "Salgssjef"
        case .helena: return "Senior decision-maker"
        case .sofie:  return "Innvendings-ekspert"
        case .espen:  return "Onboarding-coach"
        case .aaron:  return "Outreach-specialist"
        }
    }
}

// MARK: - Mapping: mal → portrett

extension PondusCast {
    /// Hvilken cast som "eier" en gitt Leadbook-mal (basert på navn).
    static func forLeadbookTemplate(_ t: LeadbookTemplate) -> PondusCast {
        let name = t.name.lowercased()
        if name.contains("første kontakt") { return .espen }
        if name.contains("oppfølging") { return .sofie }
        if name.contains("møtebooking") || name.contains("møteåpning") { return .lars }
        if name.contains("tilbud") { return .aaron }
        if name.contains("ikke til stede") || name.contains("return") { return .marit }
        if name.contains("prisinnvending") { return .sofie }
        if name.contains("beslutningstaker") { return .aaron }
        return .marit
    }

    /// Hvilken cast som spiller "kunde-rollen" i test-modus for en gitt mal.
    /// Kunde er typisk noen i seniorposisjon = Helena.
    static func clientFor(_ t: LeadbookTemplate) -> PondusCast {
        return .helena
    }
}

// MARK: - Avatar / portrett-byggesteiner

struct PortraitImage: View {
    let cast: PondusCast
    var size: CGFloat = 48
    var ringColor: Color? = nil
    var ringWidth: CGFloat = 2

    var body: some View {
        Image(cast.assetName)
            .resizable()
            .scaledToFill()
            .frame(width: size, height: size)
            .clipShape(Circle())
            .overlay(
                Circle().stroke(ringColor ?? LBrand.purpleLight.opacity(0.4), lineWidth: ringWidth)
            )
    }
}

struct PortraitPoster: View {
    let cast: PondusCast
    var height: CGFloat = 220
    var cornerRadius: CGFloat = 14
    var overlayTitle: String? = nil
    var overlaySubtitle: String? = nil

    var body: some View {
        ZStack(alignment: .bottomLeading) {
            Image(cast.assetName)
                .resizable()
                .scaledToFill()
                .frame(height: height)
                .frame(maxWidth: .infinity)
                .clipped()
            // Gradient bunn for tekst-lesbarhet
            LinearGradient(
                colors: [.clear, .black.opacity(0.7)],
                startPoint: .top, endPoint: .bottom
            )
            .allowsHitTesting(false)
            if let overlayTitle {
                VStack(alignment: .leading, spacing: 3) {
                    if let overlaySubtitle {
                        Text(overlaySubtitle.uppercased())
                            .font(.appScaled(size: 9, weight: .black))
                            .foregroundStyle(.white.opacity(0.85))
                            .tracking(0.8)
                    }
                    Text(overlayTitle)
                        .font(.appScaled(size: 16, weight: .heavy))
                        .foregroundStyle(.white)
                        .lineLimit(2)
                }
                .padding(14)
            }
        }
        .clipShape(RoundedRectangle(cornerRadius: cornerRadius))
        .overlay(RoundedRectangle(cornerRadius: cornerRadius).stroke(LBrand.purple.opacity(0.3), lineWidth: 1))
    }
}
