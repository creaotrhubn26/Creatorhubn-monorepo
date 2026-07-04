// APIClient+Academy.swift
//
// Leadgrid Academy fase 1 (mig 0368) — org-scopet opplæring.
// Kurs (offisielle + org-egne) med kapitler og progresjon per bruker.
// Backend: backend/server/leadgrid-academy-routes.ts. snake_case-JSON
// via _sharedDecoder/-Encoder.

import Foundation

// MARK: - DTO-er

struct AcademyCourseDTO: Codable, Hashable {
    let id: String
    let scope: String                 // "leadgrid_official" | "org"
    let organizationId: String?
    let slug: String
    let title: String
    let description: String?
    let posterIcon: String?
    let posterTint: String?
    let chapters: [AcademyChapterDTO]
}

struct AcademyChapterDTO: Codable, Hashable {
    let id: String
    let courseId: String
    let number: Int
    let section: String               // grunnleggende|dimensjoner|praksis|test
    let title: String
    let summary: String?
    let instructor: String?
    let durationSeconds: Int
    let posterIcon: String?
    let posterTint: String?
    let learningObjectives: [String]
    let transcriptSnippet: String?
    let hasVideo: Bool
    let watched: Bool
    let positionSeconds: Int
}

private struct AcademyCoursesResponse: Codable {
    let courses: [AcademyCourseDTO]
}

private struct AcademyProgressBody: Codable {
    let chapterId: String
    let watched: Bool
    let positionSeconds: Int
}

private struct AcademyVideoURLResponse: Codable {
    let url: String
}

private struct AcademyOkResponse: Codable { let ok: Bool }

// MARK: - Kall

extension APIClient {
    /// Alle synlige kurs (Leadgrid-offisielle + org-ens egne) med kapitler
    /// og innlogget brukers progresjon flettet inn per kapittel.
    func fetchAcademyCourses() async throws -> [AcademyCourseDTO] {
        let resp: AcademyCoursesResponse = try await _get("/api/leadgrid/academy/courses")
        return resp.courses
    }

    /// Upsert progresjon. `watched` er engangs-fremover (backend nekter
    /// å nullstille sett-status fra klient).
    func academyLogProgress(
        chapterId: String,
        watched: Bool,
        positionSeconds: Int = 0
    ) async throws {
        let _: AcademyOkResponse = try await _post(
            "/api/leadgrid/academy/progress",
            body: AcademyProgressBody(
                chapterId: chapterId,
                watched: watched,
                positionSeconds: positionSeconds
            )
        )
    }

    /// Presignert R2-URL for video-kapitler. Kaster/404 for kapitler uten
    /// video (tekst/poster-kapitler — spilleren simulerer som før).
    func academyVideoURL(chapterId: String) async throws -> URL? {
        let resp: AcademyVideoURLResponse = try await _get(
            "/api/leadgrid/academy/chapters/\(chapterId)/video-url"
        )
        return URL(string: resp.url)
    }
}
