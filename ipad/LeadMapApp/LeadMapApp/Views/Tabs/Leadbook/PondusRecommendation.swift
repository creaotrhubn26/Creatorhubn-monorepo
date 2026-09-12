// PondusRecommendation.swift
//
// «Anbefalt for deg» i Pondus-akademiet (slice B av Pondus→Akademi):
// datadrevne kapittel-anbefalinger fra TO ekte signaler, med synlig
// begrunnelse på kortet (transparens er poenget):
//   1. Quiz-profilen (PondusQuizLocalResult, slice A) — svake dimensjoner.
//   2. Kvalitets-underkjenninger (QualityReason.pondusDimension) — et
//      underkjent salg er et sterkt signal om hvilken dimensjon som svikter.
//
// Ingen backend-endringer: quiz leses lokalt, underkjenninger via den
// eksisterende kvalitetskøen (demo: KvalitetDemoStore).

import SwiftUI

// MARK: - Modell

struct PondusRecommendation: Identifiable {
    let dimension: PondusDimension
    let chapter: PondusChapter
    let reasons: [String]
    var id: UUID { chapter.id }
}

// MARK: - Motor

enum PondusRecommendationEngine {
    /// Svakhets-score per dimensjon:
    ///   quiz-signal:     (100 - dimensjonsscore) poeng
    ///   kvalitets-signal: antall underkjenninger × 40 poeng
    /// Kun dimensjoner med score > 0 OG minst én konkret begrunnelse vises;
    /// uten quiz og uten underkjenninger returneres [].
    static func recommendations(
        quiz: PondusQuizLocalResult?,
        rejections: [SalesVerification],
        chapters: [PondusChapter]
    ) -> [PondusRecommendation] {
        guard quiz != nil || !rejections.isEmpty else { return [] }

        // Underkjenninger per dimensjon (via QualityReason.pondusDimension).
        var rejectionCounts: [String: Int] = [:]
        for r in rejections where r.status == "rejected" {
            guard let code = r.reasonCode,
                  let dim = QualityReason(rawValue: code)?.pondusDimension else { continue }
            rejectionCounts[dim, default: 0] += 1
        }

        let weakest = quiz?.weakest

        var scored: [(dim: PondusDimension, score: Int, reasons: [String])] = []
        for dim in PondusDimension.allCases {
            var score = 0
            var reasons: [String] = []
            if let quiz {
                let s = quiz.score(for: dim)
                score += (100 - s)
                if dim == weakest {
                    reasons.append("Quiz: din svakeste dimensjon (\(s) av 100)")
                } else if s < 60 {
                    reasons.append("Quiz: \(s) av 100")
                }
            }
            let rc = rejectionCounts[dim.label] ?? 0
            if rc > 0 {
                score += rc * 40
                reasons.append(rc == 1
                    ? "1 underkjent salg på \(dim.label.lowercased())"
                    : "\(rc) underkjente salg på \(dim.label.lowercased())")
            }
            guard score > 0, !reasons.isEmpty else { continue }
            scored.append((dim, score, reasons))
        }

        return scored
            .sorted { $0.score > $1.score }
            .prefix(3)
            .compactMap { entry in
                // Kapittel 3-7 begynner med dimensjonsnavnet («Trygghet — …»).
                guard let ch = chapters.first(where: { $0.title.hasPrefix(entry.dim.label) })
                else { return nil }
                return PondusRecommendation(dimension: entry.dim, chapter: ch, reasons: entry.reasons)
            }
    }
}

// MARK: - Sidebar-seksjon

/// «ANBEFALT FOR DEG» øverst i kapittel-listen. Tre tilstander:
///   anbefalinger  → 1-3 kort m/ begrunnelser (tap → åpne kapittelet)
///   ingen + ikke tatt quiz → slank CTA som åpner quizen
///   ingen + quiz tatt      → skjult (alt sterkt, ingen underkjenninger)
struct PondusRecommendationSection: View {
    let recommendations: [PondusRecommendation]
    let quizTaken: Bool
    var onSelect: (PondusChapter) -> Void
    var onQuizCompleted: (PondusQuizLocalResult) -> Void

    @State private var showQuiz = false

    var body: some View {
        if !recommendations.isEmpty {
            VStack(alignment: .leading, spacing: 8) {
                header
                ForEach(recommendations) { rec in
                    recommendationCard(rec)
                }
            }
        } else if !quizTaken {
            VStack(alignment: .leading, spacing: 8) {
                header
                quizCTA
            }
            .sheet(isPresented: $showQuiz) {
                PondusQuizSheet(onCompleted: onQuizCompleted)
            }
        }
    }

    private var header: some View {
        HStack(spacing: 7) {
            Image(systemName: "sparkles")
                .font(.appScaled(size: 10, weight: .bold))
                .foregroundStyle(LBrand.purpleLight)
            Text("ANBEFALT FOR DEG")
                .font(.appScaled(size: 10, weight: .black))
                .foregroundStyle(LBrand.purpleLight)
                .tracking(0.6)
            Spacer()
        }
        .padding(.top, 6).padding(.bottom, 2)
    }

    private func recommendationCard(_ rec: PondusRecommendation) -> some View {
        Button { onSelect(rec.chapter) } label: {
            HStack(alignment: .top, spacing: 10) {
                ZStack {
                    Circle().fill(rec.dimension.tint.opacity(0.18))
                    Image(systemName: rec.chapter.posterIcon)
                        .font(.appScaled(size: 13, weight: .bold))
                        .foregroundStyle(rec.dimension.tint)
                }
                .frame(width: 34, height: 34)

                VStack(alignment: .leading, spacing: 4) {
                    Text(rec.chapter.title)
                        .font(.appScaled(size: 12, weight: .bold))
                        .foregroundStyle(.white)
                        .lineLimit(2)
                        .multilineTextAlignment(.leading)
                    ForEach(rec.reasons, id: \.self) { reason in
                        HStack(alignment: .top, spacing: 5) {
                            Circle().fill(rec.dimension.tint)
                                .frame(width: 4, height: 4)
                                .padding(.top, 4)
                            Text(reason)
                                .font(.appScaled(size: 10))
                                .foregroundStyle(LBrand.textSecondary)
                                .multilineTextAlignment(.leading)
                                .fixedSize(horizontal: false, vertical: true)
                        }
                    }
                }
                Spacer(minLength: 4)
                Image(systemName: "chevron.right")
                    .font(.appScaled(size: 10, weight: .bold))
                    .foregroundStyle(LBrand.textTertiary)
                    .padding(.top, 10)
            }
            .padding(10)
            .background(LBrand.card, in: RoundedRectangle(cornerRadius: 10))
            .overlay(
                RoundedRectangle(cornerRadius: 10)
                    .stroke(rec.dimension.tint.opacity(0.35), lineWidth: 1)
            )
        }
        .buttonStyle(.plain)
    }

    private var quizCTA: some View {
        Button { showQuiz = true } label: {
            HStack(spacing: 10) {
                Image(systemName: "checkmark.seal.fill")
                    .font(.appScaled(size: 14, weight: .semibold))
                    .foregroundStyle(LBrand.purpleLight)
                Text("Ta pondus-quizen for å få personlige anbefalinger")
                    .font(.appScaled(size: 11, weight: .semibold))
                    .foregroundStyle(.white)
                    .multilineTextAlignment(.leading)
                    .fixedSize(horizontal: false, vertical: true)
                Spacer(minLength: 4)
                Image(systemName: "chevron.right")
                    .font(.appScaled(size: 10, weight: .bold))
                    .foregroundStyle(LBrand.textTertiary)
            }
            .padding(10)
            .background(LBrand.card, in: RoundedRectangle(cornerRadius: 10))
            .overlay(
                RoundedRectangle(cornerRadius: 10)
                    .stroke(LBrand.purple.opacity(0.30), lineWidth: 1)
            )
        }
        .buttonStyle(.plain)
    }
}
