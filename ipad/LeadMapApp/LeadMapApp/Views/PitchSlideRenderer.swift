// PitchSlideRenderer.swift
//
// Diskriminert visning per slide_type. Følger pitch-spec'en fra
// Daniels brief: én idé per slide, mørkt/premium, lite tekst, mye
// visuelt, tydelige før/etter-kontraster. Bevisst nøytrale farger
// (ingen sparkles/wand.and.stars-ikonografi).
//
// Bruker:
//   - Cover:           Logo (auto-fetchet fra org-website) + tagline + org-navn
//   - Intro:           Stor påstand + kort underbygging
//   - Problem:         Tittel + brødtekst som vekker gjenkjenning
//   - CurrentFriction: Sitat-stil eksempel som viser dagens friksjon
//   - Solution:        Flyt-skisse + tittel
//   - HowItWorks:      Stor mockup + 3-stegs ramme
//   - CoreFeatures:    Ikon-grid (2 kolonner) m/ label + body
//   - BeforeAfter:     To kolonner side-om-side, posisjonelt speilet
//   - Value:           Forretningstall (lead-tilpassede når override finnes)
//   - Pilot:           Steg-liste m/ tid + omfang
//   - NextStep:        Stor CTA + selger-kontakt

import SwiftUI

struct PitchSlideRenderer: View {
    let slide: PitchSlide
    let position: Int
    let total: Int
    let coverLogoUrl: String?
    let coverTagline: String?
    let orgName: String
    /// Per-lead value-override (når valueRegen er kjørt for denne presentasjonen).
    let valueOverride: PitchValueOverride?

    /// Warm-dark palett — speiler PDF-eksporten + matcher Daniels
    /// "mørkt/premium"-retningslinje.
    private static let bg = Color(red: 0.043, green: 0.043, blue: 0.043)
    private static let accent = Color(red: 0.83, green: 0.64, blue: 0.45) // varm beige
    private static let muted = Color.white.opacity(0.82)
    private static let faded = Color.white.opacity(0.45)

    var body: some View {
        ZStack(alignment: .topLeading) {
            Self.bg
            container
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    }

    @ViewBuilder
    private var container: some View {
        switch slide.slideType {
        case "cover":            coverSlide
        case "intro":            introSlide
        case "problem":          problemSlide
        case "current_friction": frictionSlide
        case "solution":         solutionSlide
        case "how_it_works":     howItWorksSlide
        case "core_features":    coreFeaturesSlide
        case "before_after":     beforeAfterSlide
        case "value":            valueSlide
        case "pilot":            pilotSlide
        case "next_step":        nextStepSlide
        default:                 fallbackSlide
        }
    }

    // MARK: - Header (felles)

    @ViewBuilder
    private func header(_ kicker: String) -> some View {
        HStack {
            Text(kicker.uppercased())
                .font(.caption.weight(.bold))
                .tracking(2)
                .foregroundStyle(Self.accent)
            Spacer()
            Text("\(position) / \(total)")
                .font(.caption.weight(.bold))
                .foregroundStyle(Self.faded)
        }
    }

    // MARK: - Cover

    @ViewBuilder
    private var coverSlide: some View {
        VStack(alignment: .leading, spacing: 28) {
            header("Pitch")
            Spacer().frame(height: 40)
            if let urlStr = coverLogoUrl, let url = URL(string: urlStr) {
                AsyncImage(url: url) { phase in
                    switch phase {
                    case .success(let img):
                        img.resizable().scaledToFit()
                            .frame(maxHeight: 140)
                    default:
                        EmptyView()
                    }
                }
            }
            if !orgName.isEmpty {
                Text(orgName.uppercased())
                    .font(.caption.weight(.bold))
                    .tracking(3)
                    .foregroundStyle(Self.faded)
            }
            if let tagline = coverTagline, !tagline.isEmpty {
                Text(tagline)
                    .font(.system(size: 56, weight: .semibold))
                    .foregroundStyle(.white)
                    .fixedSize(horizontal: false, vertical: true)
                    .frame(maxWidth: 900, alignment: .leading)
            }
            Spacer()
        }
        .padding(.horizontal, 80)
        .padding(.vertical, 80)
    }

    // MARK: - Intro

    @ViewBuilder
    private var introSlide: some View {
        VStack(alignment: .leading, spacing: 32) {
            header("Det vi gjør")
            Spacer().frame(height: 24)
            Text(slide.titleMd)
                .font(.system(size: 56, weight: .semibold))
                .foregroundStyle(.white)
                .fixedSize(horizontal: false, vertical: true)
            Text(slide.bodyMd)
                .font(.system(size: 22, weight: .regular))
                .foregroundStyle(Self.muted)
                .lineSpacing(6)
                .frame(maxWidth: 800, alignment: .leading)
                .fixedSize(horizontal: false, vertical: true)
            Spacer()
        }
        .padding(.horizontal, 80)
        .padding(.vertical, 80)
    }

    // MARK: - Problem

    @ViewBuilder
    private var problemSlide: some View {
        VStack(alignment: .leading, spacing: 28) {
            header("Problemet")
            Spacer().frame(height: 24)
            Text(slide.titleMd)
                .font(.system(size: 56, weight: .semibold))
                .foregroundStyle(.white)
                .fixedSize(horizontal: false, vertical: true)
            HStack(alignment: .top, spacing: 16) {
                Rectangle().fill(Self.accent).frame(width: 4, height: 60)
                Text(slide.bodyMd)
                    .font(.system(size: 22, weight: .regular))
                    .foregroundStyle(Self.muted)
                    .lineSpacing(6)
                    .fixedSize(horizontal: false, vertical: true)
            }
            .frame(maxWidth: 800, alignment: .leading)
            Spacer()
        }
        .padding(.horizontal, 80)
        .padding(.vertical, 80)
    }

    // MARK: - CurrentFriction

    @ViewBuilder
    private var frictionSlide: some View {
        VStack(alignment: .leading, spacing: 28) {
            header("Dagens måte")
            Spacer().frame(height: 24)
            Text(slide.titleMd)
                .font(.system(size: 52, weight: .semibold))
                .foregroundStyle(.white)
                .fixedSize(horizontal: false, vertical: true)
            VStack(alignment: .leading, spacing: 8) {
                Text(slide.bodyMd)
                    .font(.system(size: 22, weight: .regular))
                    .foregroundStyle(Self.muted)
                    .lineSpacing(6)
                    .italic()
                    .fixedSize(horizontal: false, vertical: true)
            }
            .padding(24)
            .background(
                RoundedRectangle(cornerRadius: 16)
                    .stroke(Self.accent.opacity(0.4), lineWidth: 1)
            )
            .frame(maxWidth: 900, alignment: .leading)
            Spacer()
        }
        .padding(.horizontal, 80)
        .padding(.vertical, 80)
    }

    // MARK: - Solution

    @ViewBuilder
    private var solutionSlide: some View {
        VStack(alignment: .leading, spacing: 28) {
            header("Løsningen")
            Spacer().frame(height: 24)
            Text(slide.titleMd)
                .font(.system(size: 56, weight: .semibold))
                .foregroundStyle(.white)
                .fixedSize(horizontal: false, vertical: true)
            Text(slide.bodyMd)
                .font(.system(size: 22, weight: .regular))
                .foregroundStyle(Self.muted)
                .lineSpacing(6)
                .frame(maxWidth: 800, alignment: .leading)
                .fixedSize(horizontal: false, vertical: true)
            Spacer()
        }
        .padding(.horizontal, 80)
        .padding(.vertical, 80)
    }

    // MARK: - HowItWorks

    @ViewBuilder
    private var howItWorksSlide: some View {
        VStack(alignment: .leading, spacing: 24) {
            header("Hvordan det fungerer")
            Spacer().frame(height: 16)
            Text(slide.titleMd)
                .font(.system(size: 44, weight: .semibold))
                .foregroundStyle(.white)
                .fixedSize(horizontal: false, vertical: true)
            HStack(spacing: 32) {
                if let firstMockup = slide.mockupUrls.first,
                   let url = URL(string: firstMockup.url) {
                    AsyncImage(url: url) { phase in
                        switch phase {
                        case .success(let img):
                            img.resizable().scaledToFit()
                                .clipShape(RoundedRectangle(cornerRadius: 14))
                                .shadow(color: .black.opacity(0.5),
                                        radius: 30, x: 0, y: 12)
                                .frame(maxWidth: 560, maxHeight: 360)
                        case .empty:
                            RoundedRectangle(cornerRadius: 14)
                                .fill(Color.white.opacity(0.05))
                                .frame(maxWidth: 560, maxHeight: 360)
                                .overlay(
                                    ProgressView().tint(.white)
                                )
                        default:
                            EmptyView()
                        }
                    }
                } else {
                    placeholderMockup
                }
                Text(slide.bodyMd)
                    .font(.system(size: 20, weight: .regular))
                    .foregroundStyle(Self.muted)
                    .lineSpacing(6)
                    .frame(maxWidth: 360, alignment: .leading)
                    .fixedSize(horizontal: false, vertical: true)
            }
            Spacer()
        }
        .padding(.horizontal, 64)
        .padding(.vertical, 64)
    }

    private var placeholderMockup: some View {
        RoundedRectangle(cornerRadius: 14)
            .stroke(Color.white.opacity(0.2), style: StrokeStyle(lineWidth: 1.5, dash: [6, 6]))
            .frame(width: 540, height: 340)
            .overlay(
                VStack(spacing: 8) {
                    Image(systemName: "rectangle.dashed")
                        .font(.system(size: 32))
                        .foregroundStyle(Self.faded)
                    Text("Mockup")
                        .font(.caption)
                        .foregroundStyle(Self.faded)
                }
            )
    }

    // MARK: - CoreFeatures

    @ViewBuilder
    private var coreFeaturesSlide: some View {
        VStack(alignment: .leading, spacing: 24) {
            header("Kjernefunksjoner")
            Spacer().frame(height: 8)
            Text(slide.titleMd)
                .font(.system(size: 44, weight: .semibold))
                .foregroundStyle(.white)
                .fixedSize(horizontal: false, vertical: true)
            featuresGrid(slide.bullets)
            Spacer()
        }
        .padding(.horizontal, 64)
        .padding(.vertical, 64)
    }

    private func featuresGrid(_ bullets: [PitchSlideBullet]) -> some View {
        let columns = [
            GridItem(.flexible(), spacing: 24),
            GridItem(.flexible(), spacing: 24),
        ]
        return LazyVGrid(columns: columns, alignment: .leading, spacing: 24) {
            ForEach(bullets, id: \.label) { bullet in
                HStack(alignment: .top, spacing: 16) {
                    Image(systemName: bullet.icon)
                        .font(.system(size: 26))
                        .foregroundStyle(Self.accent)
                        .frame(width: 40, height: 40)
                        .background(
                            Self.accent.opacity(0.10),
                            in: RoundedRectangle(cornerRadius: 10)
                        )
                    VStack(alignment: .leading, spacing: 4) {
                        Text(bullet.label)
                            .font(.system(size: 20, weight: .semibold))
                            .foregroundStyle(.white)
                        if let body = bullet.body, !body.isEmpty {
                            Text(body)
                                .font(.system(size: 15))
                                .foregroundStyle(Self.muted)
                                .lineSpacing(3)
                                .fixedSize(horizontal: false, vertical: true)
                        }
                    }
                    Spacer()
                }
            }
        }
        .frame(maxWidth: 1000, alignment: .leading)
    }

    // MARK: - BeforeAfter

    @ViewBuilder
    private var beforeAfterSlide: some View {
        VStack(alignment: .leading, spacing: 24) {
            header("Før og etter")
            Spacer().frame(height: 8)
            Text(slide.titleMd)
                .font(.system(size: 44, weight: .semibold))
                .foregroundStyle(.white)
                .fixedSize(horizontal: false, vertical: true)
            HStack(alignment: .top, spacing: 32) {
                beforeAfterColumn(
                    label: "I dag",
                    items: slide.beforeAfter?.before ?? [],
                    accent: false
                )
                beforeAfterColumn(
                    label: "Med oss",
                    items: slide.beforeAfter?.after ?? [],
                    accent: true
                )
            }
            .frame(maxWidth: 1100, alignment: .leading)
            Spacer()
        }
        .padding(.horizontal, 64)
        .padding(.vertical, 64)
    }

    private func beforeAfterColumn(label: String, items: [String], accent: Bool) -> some View {
        VStack(alignment: .leading, spacing: 16) {
            Text(label.uppercased())
                .font(.caption.weight(.bold))
                .tracking(2)
                .foregroundStyle(accent ? Self.accent : Self.faded)
            ForEach(Array(items.enumerated()), id: \.offset) { _, item in
                HStack(alignment: .top, spacing: 12) {
                    Image(systemName: accent ? "checkmark" : "xmark")
                        .font(.system(size: 14, weight: .bold))
                        .foregroundStyle(accent ? Self.accent : Self.faded)
                        .frame(width: 20, height: 20)
                    Text(item)
                        .font(.system(size: 19, weight: .regular))
                        .foregroundStyle(accent ? .white : Self.muted)
                        .fixedSize(horizontal: false, vertical: true)
                }
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(24)
        .background(
            RoundedRectangle(cornerRadius: 14)
                .fill(accent ? Self.accent.opacity(0.08) : Color.white.opacity(0.03))
        )
    }

    // MARK: - Value (lead-tilpasset hvis override eksisterer)

    @ViewBuilder
    private var valueSlide: some View {
        let title = valueOverride?.titleMd ?? slide.titleMd
        let body = valueOverride?.bodyMd ?? slide.bodyMd
        let bullets = (valueOverride?.bullets.isEmpty == false)
            ? (valueOverride?.bullets ?? [])
            : slide.bullets
        VStack(alignment: .leading, spacing: 24) {
            HStack {
                Text("Verdien".uppercased())
                    .font(.caption.weight(.bold))
                    .tracking(2)
                    .foregroundStyle(Self.accent)
                if valueOverride != nil {
                    Text("· tilpasset")
                        .font(.caption.weight(.bold))
                        .foregroundStyle(Self.faded)
                }
                Spacer()
                Text("\(position) / \(total)")
                    .font(.caption.weight(.bold))
                    .foregroundStyle(Self.faded)
            }
            Spacer().frame(height: 8)
            Text(title)
                .font(.system(size: 48, weight: .semibold))
                .foregroundStyle(.white)
                .fixedSize(horizontal: false, vertical: true)
            if !body.isEmpty {
                Text(body)
                    .font(.system(size: 20, weight: .regular))
                    .foregroundStyle(Self.muted)
                    .frame(maxWidth: 800, alignment: .leading)
                    .fixedSize(horizontal: false, vertical: true)
            }
            if !bullets.isEmpty {
                featuresGrid(bullets)
                    .padding(.top, 8)
            }
            Spacer()
        }
        .padding(.horizontal, 64)
        .padding(.vertical, 64)
    }

    // MARK: - Pilot

    @ViewBuilder
    private var pilotSlide: some View {
        VStack(alignment: .leading, spacing: 24) {
            header("Pilot")
            Spacer().frame(height: 16)
            Text(slide.titleMd)
                .font(.system(size: 48, weight: .semibold))
                .foregroundStyle(.white)
                .fixedSize(horizontal: false, vertical: true)
            VStack(alignment: .leading, spacing: 14) {
                ForEach(Array(splitBodyToLines(slide.bodyMd).enumerated()), id: \.offset) { idx, line in
                    HStack(alignment: .top, spacing: 14) {
                        Text("\(idx + 1)")
                            .font(.system(size: 18, weight: .bold))
                            .frame(width: 28, height: 28)
                            .foregroundStyle(.white)
                            .background(Self.accent, in: Circle())
                        Text(line)
                            .font(.system(size: 20, weight: .regular))
                            .foregroundStyle(Self.muted)
                            .fixedSize(horizontal: false, vertical: true)
                    }
                }
            }
            .frame(maxWidth: 800, alignment: .leading)
            Spacer()
        }
        .padding(.horizontal, 80)
        .padding(.vertical, 80)
    }

    private func splitBodyToLines(_ body: String) -> [String] {
        // Del på punktum eller linjeskift; trimm; behold 1-5 linjer
        let parts = body
            .replacingOccurrences(of: "\n", with: ". ")
            .split(separator: ".", omittingEmptySubsequences: true)
            .map { $0.trimmingCharacters(in: .whitespacesAndNewlines) }
            .filter { !$0.isEmpty }
        if parts.count >= 2 { return Array(parts.prefix(5)) }
        return [body]
    }

    // MARK: - NextStep

    @ViewBuilder
    private var nextStepSlide: some View {
        VStack(alignment: .leading, spacing: 24) {
            header("Neste steg")
            Spacer().frame(height: 32)
            Text(slide.titleMd)
                .font(.system(size: 64, weight: .semibold))
                .foregroundStyle(.white)
                .fixedSize(horizontal: false, vertical: true)
            Text(slide.bodyMd)
                .font(.system(size: 22, weight: .regular))
                .foregroundStyle(Self.muted)
                .frame(maxWidth: 800, alignment: .leading)
                .fixedSize(horizontal: false, vertical: true)
            Spacer()
            HStack {
                Image(systemName: "arrow.right.circle.fill")
                    .font(.system(size: 32))
                    .foregroundStyle(Self.accent)
                Text("Vi tar det videre i dag")
                    .font(.system(size: 18, weight: .semibold))
                    .foregroundStyle(Self.accent)
                Spacer()
            }
        }
        .padding(.horizontal, 80)
        .padding(.vertical, 80)
    }

    // MARK: - Fallback (custom/legacy)

    @ViewBuilder
    private var fallbackSlide: some View {
        VStack(alignment: .leading, spacing: 28) {
            header(slide.slideType)
            Spacer().frame(height: 24)
            Text(slide.titleMd)
                .font(.system(size: 56, weight: .semibold))
                .foregroundStyle(.white)
                .fixedSize(horizontal: false, vertical: true)
            Text(slide.bodyMd)
                .font(.system(size: 22, weight: .regular))
                .foregroundStyle(Self.muted)
                .lineSpacing(6)
                .fixedSize(horizontal: false, vertical: true)
            Spacer()
        }
        .padding(.horizontal, 80)
        .padding(.vertical, 80)
    }
}
