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

    // MARK: - Fase 2: org-egne kurs (admin-gated i backend)

    func academyCreateCourse(
        title: String,
        description: String?,
        posterIcon: String = "graduationcap.fill",
        posterTint: String = "purpleLight"
    ) async throws -> String {
        struct Body: Codable {
            let title: String
            let description: String?
            let posterIcon: String
            let posterTint: String
        }
        struct Resp: Codable { let id: String }
        let resp: Resp = try await _post(
            "/api/leadgrid/academy/courses",
            body: Body(title: title, description: description,
                       posterIcon: posterIcon, posterTint: posterTint)
        )
        return resp.id
    }

    func academyDeleteCourse(courseId: String) async throws {
        try await _delete("/api/leadgrid/academy/courses/\(courseId)")
    }

    func academyCreateChapter(
        courseId: String,
        title: String,
        summary: String?,
        section: String = "praksis",
        durationSeconds: Int = 0
    ) async throws -> String {
        struct Body: Codable {
            let title: String
            let summary: String?
            let section: String
            let durationSeconds: Int
        }
        struct Resp: Codable { let id: String }
        let resp: Resp = try await _post(
            "/api/leadgrid/academy/courses/\(courseId)/chapters",
            body: Body(title: title, summary: summary,
                       section: section, durationSeconds: durationSeconds)
        )
        return resp.id
    }

    func academyDeleteChapter(chapterId: String) async throws {
        try await _delete("/api/leadgrid/academy/chapters/\(chapterId)")
    }

    /// Presignert PUT for video-opplasting. Returnerer (url, key) — last opp
    /// rå video-data med PUT + Content-Type, deretter `academyAttachVideo`.
    func academyVideoUploadURL(
        chapterId: String,
        contentType: String = "video/mp4"
    ) async throws -> (url: URL, key: String) {
        struct Body: Codable { let contentType: String }
        struct Resp: Codable { let url: String; let key: String }
        let resp: Resp = try await _post(
            "/api/leadgrid/academy/chapters/\(chapterId)/video-upload-url",
            body: Body(contentType: contentType)
        )
        guard let url = URL(string: resp.url) else {
            throw APIError.invalidResponse
        }
        return (url, resp.key)
    }

    func academyAttachVideo(
        chapterId: String,
        key: String,
        durationSeconds: Int?
    ) async throws {
        struct Body: Codable { let key: String; let durationSeconds: Int? }
        let _: AcademyOkResponse = try await _post(
            "/api/leadgrid/academy/chapters/\(chapterId)/video-attach",
            body: Body(key: key, durationSeconds: durationSeconds)
        )
    }

    /// Laster opp video-data direkte til presignert R2-URL (utenfor
    /// API-baseURL — egen URLSession-request med PUT).
    nonisolated func academyUploadVideoData(
        _ data: Data,
        to url: URL,
        contentType: String
    ) async throws {
        var req = URLRequest(url: url)
        req.httpMethod = "PUT"
        req.setValue(contentType, forHTTPHeaderField: "Content-Type")
        req.timeoutInterval = 300
        let (_, resp) = try await URLSession.shared.upload(for: req, from: data)
        guard let http = resp as? HTTPURLResponse, (200..<300).contains(http.statusCode) else {
            throw APIError.invalidResponse
        }
    }
}
