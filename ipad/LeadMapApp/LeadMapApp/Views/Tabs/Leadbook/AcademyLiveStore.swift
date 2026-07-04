// AcademyLiveStore.swift — Leadgrid Academy fase 1 (2026-07-04)
//
// Live-kilde for Pondus-Akademiet: laster kurs/kapitler fra backend
// (mig 0368) og persisterer progresjon per bruker. PondusAcademyData.chapters
// er en computed var som leser herfra — alle eksisterende views (banner,
// spiller, kapittel-liste) blir API-backet uten endring, med den innebygde
// mocken som fallback når API-et ikke er lastet eller demo-modus er på.

import SwiftUI

@MainActor
@Observable
final class AcademyLiveStore {
    static let shared = AcademyLiveStore()
    private init() {}

    private var api: APIClient?

    /// Kapitler fra backend — nil til første vellykkede last (→ mock brukes).
    private(set) var liveChapters: [PondusChapter]?
    /// Backend-kapittel-id per stabil kapittel-UUID (for progress-kall).
    private(set) var backendIds: [UUID: String] = [:]
    /// Sett-status fra server ved last — PondusTab fletter inn i sin state.
    private(set) var serverWatched: Set<UUID> = []

    func attach(api: APIClient?) {
        self.api = api
    }

    /// Kapitlene views faktisk skal vise. Demo-modus = alltid mock.
    var chapters: [PondusChapter]? {
        DemoModeManager.isActiveNonisolated ? nil : liveChapters
    }

    func load() async {
        guard !DemoModeManager.isActiveNonisolated, let api else { return }
        do {
            let courses = try await api.fetchAcademyCourses()
            // Fase 1: Pondus-Akademiet er det offisielle kurset. Org-egne
            // kurs (scope=org) listes i egen kurs-oversikt i fase 2.
            guard let course = courses.first(where: { $0.slug == "pondus-akademiet" })
                ?? courses.first(where: { $0.scope == "leadgrid_official" }) else { return }

            var mapped: [PondusChapter] = []
            var ids: [UUID: String] = [:]
            var watchedSet: Set<UUID> = []
            for dto in course.chapters.sorted(by: { $0.number < $1.number }) {
                // Stabil UUID fra backend-id så sett-status og valgt kapittel
                // overlever re-mapping (samme mønster som LeadRow).
                let uid = UUID(uuidString: dto.id) ?? UUID()
                let chapter = PondusChapter(
                    id: uid,
                    number: dto.number,
                    section: Self.mapSection(dto.section),
                    title: dto.title,
                    summary: dto.summary ?? "",
                    instructor: dto.instructor ?? "Leadgrid",
                    duration: dto.durationSeconds,
                    posterIcon: dto.posterIcon ?? "book.fill",
                    posterTint: Self.mapTint(dto.posterTint),
                    learningObjectives: dto.learningObjectives,
                    transcriptSnippet: dto.transcriptSnippet ?? "",
                    hasVideo: dto.hasVideo
                )
                mapped.append(chapter)
                ids[uid] = dto.id
                if dto.watched { watchedSet.insert(uid) }
            }
            guard !mapped.isEmpty else { return }
            self.liveChapters = mapped
            self.backendIds = ids
            self.serverWatched = watchedSet
        } catch {
            // Mock-fallback er alltid gyldig innhold — ikke støy brukeren.
            print("[academy] kurs-last feilet: \(error)")
        }
    }

    /// Persister at et kapittel er sett. Fire-and-forget fra UI-tråden.
    func logWatched(_ chapterId: UUID, positionSeconds: Int = 0) {
        guard let api, let backendId = backendIds[chapterId] else { return }
        Task {
            do {
                try await api.academyLogProgress(
                    chapterId: backendId,
                    watched: true,
                    positionSeconds: positionSeconds
                )
            } catch {
                print("[academy] progress-lagring feilet: \(error)")
            }
        }
    }

    // MARK: - Mapping

    private static func mapSection(_ raw: String) -> PondusChapter.Section {
        switch raw {
        case "grunnleggende": return .grunnleggende
        case "dimensjoner": return .dimensjoner
        case "praksis": return .praksis
        case "test": return .test
        default: return .grunnleggende
        }
    }

    private static func mapTint(_ token: String?) -> Color {
        switch token {
        case "yellow": return LBrand.yellow
        case "orange": return LBrand.orange
        case "red": return LBrand.red
        case "green": return LBrand.green
        case "blue": return LBrand.blue
        default: return LBrand.purpleLight
        }
    }
}
