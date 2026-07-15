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

    // ── Fase 2: full kursliste (offisielle + org-egne) ───────────────
    /// Alle synlige kurs som DTO-er (Akademi-flaten i Leadbook).
    private(set) var courses: [AcademyCourseDTO] = []
    /// Kapitler per kurs-id, mappet til view-modellen.
    private(set) var chaptersByCourse: [String: [PondusChapter]] = [:]

    func attach(api: APIClient?) {
        self.api = api
    }

    var apiClient: APIClient? { api }

    /// Kapitlene views faktisk skal vise. Demo-modus = alltid mock.
    var chapters: [PondusChapter]? {
        DemoModeManager.isActiveNonisolated ? nil : liveChapters
    }

    func load() async {
        guard !DemoModeManager.isActiveNonisolated, let api else { return }
        do {
            let courses = try await api.fetchAcademyCourses()

            // Fase 2: hele kurslisten mappes for Akademi-flaten.
            self.courses = courses
            var byCourse: [String: [PondusChapter]] = [:]
            for c in courses {
                var list: [PondusChapter] = []
                for dto in c.chapters.sorted(by: { $0.number < $1.number }) {
                    let uid = UUID(uuidString: dto.id) ?? UUID()
                    list.append(Self.mapChapter(dto, id: uid))
                    backendIds[uid] = dto.id
                    if dto.watched { serverWatched.insert(uid) }
                }
                byCourse[c.id] = list
            }
            self.chaptersByCourse = byCourse

            // Pondus-Akademiet driver banner/spiller i Pondus-fanen.
            if let course = courses.first(where: { $0.slug == "pondus-akademiet" })
                ?? courses.first(where: { $0.scope == "leadgrid_official" }),
               let mapped = byCourse[course.id], !mapped.isEmpty {
                self.liveChapters = mapped
            }
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

    /// Presignert avspillings-URL for et video-kapittel. nil hvis kapittelet
    /// ikke er backend-backet, API mangler, eller kapittelet ikke har video.
    func videoURL(for chapterId: UUID) async -> URL? {
        guard let api, let backendId = backendIds[chapterId] else { return nil }
        do {
            return try await api.academyVideoURL(chapterId: backendId)
        } catch {
            print("[academy] video-url feilet: \(error)")
            return nil
        }
    }

    // MARK: - Mapping

    /// Stabil UUID fra backend-id så sett-status og valgt kapittel
    /// overlever re-mapping (samme mønster som LeadRow).
    private static func mapChapter(_ dto: AcademyChapterDTO, id: UUID) -> PondusChapter {
        PondusChapter(
            id: id,
            number: dto.number,
            section: mapSection(dto.section),
            title: dto.title,
            summary: dto.summary ?? "",
            instructor: dto.instructor ?? "Leadgrid",
            duration: dto.durationSeconds,
            posterIcon: dto.posterIcon ?? "book.fill",
            posterTint: mapTint(dto.posterTint),
            learningObjectives: dto.learningObjectives,
            transcriptSnippet: dto.transcriptSnippet ?? "",
            hasVideo: dto.hasVideo
        )
    }

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
