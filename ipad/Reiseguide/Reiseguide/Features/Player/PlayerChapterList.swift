// PlayerChapterList.swift
//
// Kapitler i avspilleren (item 4): en rad med forrige/neste-kapittel-knapper
// og en midtre knapp («Kapittel 2 av 5») som åpner kapittellisten i et ark —
// et eget ark (fremfor en utfoldbar liste inne i scrollen) leser bedre med
// VoiceOver her, siden det gir én tydelig liste å navigere i stedet for enda
// et nivå i en allerede lang sekundær-scroll. Skjult når stedet bare har ett
// kapittel (`PlayerViewModel.hasMultipleChapters`).

import SwiftUI

/// Forrige/neste-kapittel og kapittelliste-knappen, plassert rett under
/// TransportControls i PlayerView.
struct ChapterNavRow: View {
    let currentChapterNo: Int
    let totalChapters: Int
    let uiLang: String
    let onPrevious: () -> Void
    let onNext: () -> Void
    let onShowList: () -> Void

    var body: some View {
        HStack(spacing: AppSpacing.m) {
            Button(action: onPrevious) {
                Image(systemName: "backward.end.fill")
                    .font(.system(size: 16, weight: .semibold))
                    .foregroundStyle(AppColor.textPrimary)
                    .minTapTarget()
            }
            .buttonStyle(PressableButtonStyle())
            .accessibilityLabel(Text("player.chapter.previous"))

            Spacer(minLength: 0)

            Button(action: onShowList) {
                Text(progressText)
                    .font(AppFont.chip)
                    .foregroundStyle(AppColor.textPrimary)
                    .padding(.horizontal, AppSpacing.l)
                    .frame(minHeight: AppSpacing.minTapTarget)
                    .background(AppColor.bgElevated, in: Capsule())
            }
            .buttonStyle(PressableButtonStyle())
            .accessibilityHint(Text("player.chapters.showHint"))

            Spacer(minLength: 0)

            Button(action: onNext) {
                Image(systemName: "forward.end.fill")
                    .font(.system(size: 16, weight: .semibold))
                    .foregroundStyle(AppColor.textPrimary)
                    .minTapTarget()
            }
            .buttonStyle(PressableButtonStyle())
            .accessibilityLabel(Text("player.chapter.next"))
        }
    }

    private var progressText: String {
        L10n.string("player.chapters.progress", lang: uiLang)
            .replacingOccurrences(of: "%1$@", with: "\(currentChapterNo)")
            .replacingOccurrences(of: "%2$@", with: "\(totalChapters)")
    }
}

/// Selve kapittellisten: nummer, tittel, varighet og status (spilles nå /
/// hørt), 44 pt rader.
struct PlayerChapterListSheet: View {
    let chapters: [GuideChapter]
    let currentChapterNo: Int?
    let completedChapterNos: Set<Int>
    let locale: Locale
    let uiLang: String
    let onSelect: (Int) -> Void

    @Environment(\.dismiss) private var dismiss

    var body: some View {
        NavigationStack {
            List {
                ForEach(Array(chapters.enumerated()), id: \.element.id) { index, chapter in
                    Button {
                        onSelect(index)
                        dismiss()
                    } label: {
                        PlayerChapterRow(
                            chapter: chapter,
                            locale: locale,
                            uiLang: uiLang,
                            isCurrent: chapter.no == currentChapterNo,
                            isCompleted: completedChapterNos.contains(chapter.no)
                        )
                    }
                    .buttonStyle(.plain)
                    .listRowBackground(AppColor.bgBase)
                }
            }
            .listStyle(.plain)
            .scrollContentBackground(.hidden)
            .background(AppColor.bgBase)
            .navigationTitle(Text("player.chapters.title"))
            .navigationBarTitleDisplayMode(.inline)
            .toolbarBackground(AppColor.bgBase, for: .navigationBar)
            .toolbar {
                ToolbarItem(placement: .confirmationAction) {
                    Button("action.done") { dismiss() }
                        .foregroundStyle(AppColor.accent)
                }
            }
        }
        .preferredColorScheme(.dark)
        .presentationDetents([.medium, .large])
        .presentationDragIndicator(.visible)
    }
}

struct PlayerChapterRow: View {
    let chapter: GuideChapter
    let locale: Locale
    let uiLang: String
    let isCurrent: Bool
    let isCompleted: Bool

    @Environment(\.contrastColors) private var contrast

    var body: some View {
        HStack(spacing: AppSpacing.m) {
            Text("\(chapter.no)")
                .font(AppFont.meta)
                .foregroundStyle(contrast.textSecondary)
                .frame(width: 24, alignment: .leading)
            VStack(alignment: .leading, spacing: 2) {
                Text(chapter.title ?? "")
                    .font(AppFont.cardTitle)
                    .foregroundStyle(isCurrent ? AppColor.accent : AppColor.textPrimary)
                Text(L10n.shortDuration(seconds: chapter.playbackDurationS, locale: locale))
                    .font(AppFont.meta)
                    .foregroundStyle(contrast.textTertiary)
            }
            Spacer(minLength: 0)
            statusIcon
        }
        .frame(minHeight: AppSpacing.minTapTarget)
        .contentShape(Rectangle())
        .accessibilityElement(children: .ignore)
        .accessibilityLabel(Text(accessibilityText))
    }

    @ViewBuilder
    private var statusIcon: some View {
        if isCurrent {
            Image(systemName: "waveform")
                .foregroundStyle(AppColor.accent)
                .accessibilityHidden(true)
        } else if isCompleted {
            Image(systemName: "checkmark.circle.fill")
                .foregroundStyle(contrast.textSecondary)
                .accessibilityHidden(true)
        }
    }

    private var accessibilityText: String {
        var parts = ["\(chapter.no). \(chapter.title ?? "")", L10n.shortDuration(seconds: chapter.playbackDurationS, locale: locale)]
        if isCurrent {
            parts.append(L10n.string("player.chapters.current", lang: uiLang))
        } else if isCompleted {
            parts.append(L10n.string("player.chapters.completed", lang: uiLang))
        }
        return parts.joined(separator: ", ")
    }
}
