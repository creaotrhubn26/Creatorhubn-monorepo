// APIClient.swift
//
// Tynn URLSession-wrapper for /api/admin-room/lead-map/* endepunkter.
// Alle metoder er async throws — caller bestemmer error-handling.
//
// Base-URL er hardkodet til prod. Lokal-utvikling kan overstyre via
// LEAD_MAP_API_BASE i Info.plist senere.

import Foundation
import CoreLocation

actor APIClient {
    private let token: String
    private let baseURL: URL
    private let session: URLSession

    init(token: String, baseURL: URL = URL(string: "https://creatorhub-backend-rtbl.onrender.com")!) {
        self.token = token
        self.baseURL = baseURL
        let config = URLSessionConfiguration.default
        config.timeoutIntervalForRequest = 20
        config.waitsForConnectivity = true
        self.session = URLSession(configuration: config)
    }

    // MARK: - GET-endepunkter

    /// Bygg ?projectId=… query-string når aktivt prosjekt er satt.
    private func projectQuery(_ projectId: String?, sep: String = "?") -> String {
        guard let p = projectId, !p.isEmpty else { return "" }
        let encoded = p.addingPercentEncoding(withAllowedCharacters: .urlQueryAllowed) ?? p
        return "\(sep)projectId=\(encoded)"
    }

    func fetchLeads(projectId: String? = nil) async throws -> [LeadModel] {
        let resp: LeadsResponse = try await get("/api/admin-room/lead-map/leads\(projectQuery(projectId))")
        return resp.leads
    }

    func fetchLead(id: String) async throws -> LeadModel {
        try await get("/api/admin-room/lead-map/leads/\(id)")
    }

    func fetchCompetitors(projectId: String? = nil) async throws -> [CompetitorModel] {
        let resp: CompetitorsResponse = try await get("/api/admin-room/lead-map/competitors\(projectQuery(projectId))")
        return resp.competitors
    }

    func fetchMetrics(projectId: String? = nil) async throws -> MetricsModel {
        try await get("/api/admin-room/lead-map/metrics\(projectQuery(projectId))")
    }

    func fetchCalendar(projectId: String? = nil) async throws -> [CalendarEvent] {
        let resp: CalendarResponse = try await get("/api/admin-room/lead-map/calendar\(projectQuery(projectId))")
        return resp.events
    }

    func fetchReminders(projectId: String? = nil) async throws -> RemindersResponse {
        try await get("/api/admin-room/lead-map/reminders\(projectQuery(projectId))")
    }

    func fetchProjects() async throws -> [ProjectListItem] {
        let resp: ProjectsResponse = try await get("/api/admin-room/lead-map/projects")
        return resp.projects
    }

    func fetchProjectSummary(id: String) async throws -> ProjectSummary {
        try await get("/api/admin-room/lead-map/projects/\(id)/summary")
    }

    func fetchEnrichment(leadId: String) async throws -> EnrichmentModel? {
        let resp: EnrichmentEnvelope = try await get(
            "/api/admin-room/lead-map/leads/\(leadId)/enrichment"
        )
        return resp.enrichment
    }

    func fetchDemographics(leadId: String) async throws -> DemographicsModel? {
        let resp: DemographicsEnvelope = try await get(
            "/api/admin-room/lead-map/leads/\(leadId)/demographics"
        )
        return resp.demographics
    }

    // MARK: - PATCH/POST

    func updateStatus(leadId: String, status: String) async throws {
        try await patch(
            "/api/admin-room/lead-map/leads/\(leadId)/status",
            body: ["status": status]
        )
    }

    func logVisit(leadId: String, body: [String: Any]) async throws {
        try await post(
            "/api/admin-room/lead-map/leads/\(leadId)/visits",
            body: body
        )
    }

    /// Sendable-vennlig variant — body er ferdig JSON-serialisert til Data.
    func logVisitRaw(leadId: String, jsonBody: Data) async throws {
        var req = makeRequest("/api/admin-room/lead-map/leads/\(leadId)/visits", method: "POST")
        req.httpBody = jsonBody
        let (_, response) = try await session.data(for: req)
        try Self.validate(response)
    }

    func generateStrategy(leadId: String) async throws -> StrategyModel {
        let resp: StrategyEnvelope = try await post(
            "/api/admin-room/lead-map/leads/\(leadId)/strategy"
        )
        return resp.strategy
    }

    func triggerEnrichment(leadId: String) async throws -> EnrichmentModel? {
        let resp: EnrichmentEnvelope = try await post(
            "/api/admin-room/lead-map/leads/\(leadId)/enrich"
        )
        return resp.enrichment
    }

    // MARK: - Min dag (PR #616)

    func fetchWorkload(
        organizationId: String?,
        location: CLLocation? = nil
    ) async throws -> WorkloadResponse {
        var qs: [String] = []
        if let orgId = organizationId {
            qs.append("organization_id=\(orgId)")
        }
        if let loc = location {
            qs.append("lat=\(loc.coordinate.latitude)")
            qs.append("lng=\(loc.coordinate.longitude)")
        }
        let q = qs.isEmpty ? "" : "?\(qs.joined(separator: "&"))"
        return try await get("/api/admin-room/lead-map/me/workload\(q)")
    }

    func fetchQuota(organizationId: String) async throws -> QuotaProgress {
        try await get("/api/admin-room/lead-map/me/quota?organization_id=\(organizationId)")
    }

    // MARK: - Organisasjoner (PR #611+#612)

    func fetchOrganizations() async throws -> [OrganizationSummary] {
        let resp: OrgsResponse = try await get("/api/admin-room/lead-map/organizations")
        return resp.organizations
    }

    func fetchOrgProfile(_ organizationId: String) async throws -> OrgProfileEnvelope {
        try await get("/api/admin-room/lead-map/organizations/\(organizationId)/profile")
    }

    func fetchOrgMembers(_ organizationId: String) async throws -> [MemberProfile] {
        let resp: OrgProfilesResponse = try await get(
            "/api/admin-room/lead-map/organizations/\(organizationId)/profiles"
        )
        return resp.profiles
    }

    func fetchSalesTeams(_ organizationId: String) async throws -> [SalesTeam] {
        let resp: TeamsResponse = try await get(
            "/api/admin-room/lead-map/organizations/\(organizationId)/teams"
        )
        return resp.teams
    }

    func fetchMemberLocations(_ organizationId: String) async throws -> [MemberLocation] {
        let resp: MemberLocationsResponse = try await get(
            "/api/admin-room/lead-map/organizations/\(organizationId)/member-locations"
        )
        return resp.locations
    }

    // MARK: - RBAC (PR #615)

    func fetchPermissions(organizationId: String?) async throws -> PermissionsResponse {
        let q = organizationId.map { "?organization_id=\($0)" } ?? ""
        return try await get("/api/admin-room/lead-map/me/permissions\(q)")
    }

    // MARK: - Heartbeat + posisjons-deling (PR #612)

    func sendHeartbeat(
        organizationId: String,
        location: CLLocation? = nil,
        activity: String = "idle"
    ) async throws {
        var body: [String: Any] = ["organization_id": organizationId]
        if let loc = location {
            body["lat"] = loc.coordinate.latitude
            body["lng"] = loc.coordinate.longitude
            body["accuracy_m"] = loc.horizontalAccuracy
            body["activity"] = activity
        }
        try await post("/api/admin-room/lead-map/heartbeat", body: body)
    }

    func setLocationConsent(_ organizationId: String, consent: Bool) async throws {
        if consent {
            try await post(
                "/api/admin-room/lead-map/organizations/\(organizationId)/location/consent",
                body: [:]
            )
        } else {
            try await delete(
                "/api/admin-room/lead-map/organizations/\(organizationId)/location/consent"
            )
        }
    }

    func fetchLocationConsent(_ organizationId: String) async throws -> Bool {
        let resp: ConsentResponse = try await get(
            "/api/admin-room/lead-map/organizations/\(organizationId)/location/consent"
        )
        return resp.consented
    }

    // MARK: - Team-leaderboard (PR #620)

    func fetchLeaderboard(
        organizationId: String,
        period: String = "this_month",
        teamId: String? = nil,
        sort: String = "progress"
    ) async throws -> LeaderboardResponse {
        var qs = "?period=\(period)&sort=\(sort)"
        if let tid = teamId, !tid.isEmpty {
            qs += "&team_id=\(tid)"
        }
        return try await get(
            "/api/admin-room/lead-map/organizations/\(organizationId)/leaderboard\(qs)"
        )
    }

    func fetchLeaderboardSummary(
        organizationId: String,
        period: String = "this_month"
    ) async throws -> LeaderboardSummary {
        try await get(
            "/api/admin-room/lead-map/organizations/\(organizationId)/leaderboard-summary?period=\(period)"
        )
    }

    // MARK: - Kart-annotasjoner (PR #629)

    func fetchAnnotations(
        organizationId: String,
        assignedToMeOnly: Bool = false
    ) async throws -> AnnotationsResponse {
        let qs = assignedToMeOnly ? "?assigned_to_me_only=true" : ""
        return try await get(
            "/api/admin-room/lead-map/organizations/\(organizationId)/annotations\(qs)"
        )
    }

    /// Opprett ny annotasjon. Returnerer ID.
    func createAnnotation(
        organizationId: String,
        payload: AnnotationCreatePayload
    ) async throws -> String {
        let resp: CreateAnnotationResponse = try await post(
            "/api/admin-room/lead-map/organizations/\(organizationId)/annotations",
            body: payload.jsonBody
        )
        return resp.id
    }

    func archiveAnnotation(_ id: String) async throws {
        try await post(
            "/api/admin-room/lead-map/annotations/\(id)/archive",
            body: [:]
        )
    }

    // MARK: - Smart-transkript (PR #642 — Claude analyserer dikterings-notater)

    func analyzeTranscript(leadId: String, transcript: String) async throws -> TranscriptAnalysis {
        try await post(
            "/api/admin-room/lead-map/visits/parse-transcript",
            body: ["lead_id": leadId, "transcript": transcript]
        )
    }

    // MARK: - Meeting-brief (PR #642 — Claude forbereder selger til besøk)

    func fetchMeetingBrief(leadId: String) async throws -> MeetingBrief {
        try await post(
            "/api/admin-room/lead-map/leads/\(leadId)/meeting-brief",
            body: [:]
        )
    }

    // MARK: - Visittkort-skanner (PR #642)

    func createLeadFromCard(extracted: ExtractedBusinessCard) async throws {
        var body: [String: Any] = ["name": extracted.name]
        if !extracted.company.isEmpty { body["company"] = extracted.company }
        if !extracted.title.isEmpty { body["title"] = extracted.title }
        if !extracted.email.isEmpty { body["email"] = extracted.email }
        if !extracted.phone.isEmpty { body["phone"] = extracted.phone }
        if !extracted.website.isEmpty { body["website"] = extracted.website }
        if !extracted.raw.isEmpty { body["raw_text"] = extracted.raw }
        try await post("/api/admin-room/lead-map/leads/from-card", body: body)
    }

    // MARK: - Varsler (PR #622)

    func fetchNotifications(unreadOnly: Bool = false, limit: Int = 50) async throws -> NotificationFeedResponse {
        let qs = "?unread_only=\(unreadOnly)&limit=\(limit)"
        return try await get("/api/admin-room/lead-map/me/notifications\(qs)")
    }

    func markNotificationRead(_ id: String) async throws {
        try await post("/api/admin-room/lead-map/me/notifications/\(id)/read", body: [:])
    }

    func markAllNotificationsRead() async throws {
        try await post("/api/admin-room/lead-map/me/notifications/read-all", body: [:])
    }

    func registerDeviceToken(
        token: String,
        platform: String = "apns",
        deviceName: String? = nil,
        appVersion: String? = nil
    ) async throws {
        var body: [String: Any] = [
            "platform": platform,
            "token": token,
        ]
        if let dn = deviceName { body["device_name"] = dn }
        if let av = appVersion { body["app_version"] = av }
        try await post("/api/admin-room/lead-map/me/notifications/device-token", body: body)
    }

    /// Trigger fra CLCircularRegion didEnterRegion. Backend håndterer
    /// 4-timers throttle + tildelt-sjekk. Returnerer void; server-side
    /// suppressed-flagg er kun til logg.
    func notifyApproachingLead(leadId: String, distanceM: Double? = nil) async throws {
        var body: [String: Any] = ["lead_id": leadId]
        if let d = distanceM { body["distance_m"] = d }
        try await post("/api/admin-room/lead-map/me/approaching-lead", body: body)
    }

    // MARK: - Lead-tildeling (PR #616)

    func assignLead(_ leadId: String, toUserId: String, reason: String = "manual") async throws {
        try await post(
            "/api/admin-room/lead-map/leads/\(leadId)/assign",
            body: ["user_id": toUserId, "reason": reason]
        )
    }

    func releaseLead(_ leadId: String) async throws {
        try await post(
            "/api/admin-room/lead-map/leads/\(leadId)/release",
            body: [:]
        )
    }

    // MARK: - Pitch Deck Studio

    /// Lett-vekts sjekk for prosjekt-kort: har org et klart deck?
    /// Returnerer { available: false } hvis ingen ready-deck finnes.
    /// 403 hvis kaller mangler pitch_deck.access.
    func fetchPitchDeckAvailability(orgId: String) async throws -> PitchDeckAvailability {
        return try await get(
            "/api/admin-room/lead-map/pitch-deck/availability?organization_id=\(orgId)"
        )
    }

    func listPitchDecks(orgId: String) async throws -> PitchDecksResponse {
        return try await get(
            "/api/admin-room/lead-map/pitch-deck/decks?organization_id=\(orgId)"
        )
    }

    func loadPitchDeck(deckId: String) async throws -> PitchDeckBundle {
        return try await get(
            "/api/admin-room/lead-map/pitch-deck/decks/\(deckId)"
        )
    }

    func onboardPitchDeck(payload: PitchOnboardingPayload) async throws -> PitchDeckBundle {
        var body: [String: Any] = [
            "organization_id": payload.organizationId,
            "name": payload.name,
            "industry": payload.industry,
            "one_liner": payload.oneLiner,
            "target_customer": payload.targetCustomer,
            "pains": payload.pains,
            "differentiators": payload.differentiators,
            "proof_points": payload.proofPoints,
            "locale": payload.locale,
            "format": payload.format,
        ]
        if let url = payload.websiteUrl, !url.isEmpty {
            body["website_url"] = url
        }
        return try await post(
            "/api/admin-room/lead-map/pitch-deck/decks/onboard",
            body: body
        )
    }

    // MARK: Brief + Value + Finalize

    func fetchPitchBrief(deckId: String, leadId: String) async throws -> PitchBriefResponse {
        return try await post(
            "/api/admin-room/lead-map/pitch-deck/presentations/brief",
            body: ["deck_id": deckId, "lead_id": leadId]
        )
    }

    func generateValueForLead(
        deckId: String, leadId: String, presentationId: String?
    ) async throws -> PitchValueOverrideResponse {
        var body: [String: Any] = ["lead_id": leadId]
        if let p = presentationId { body["presentation_id"] = p }
        return try await post(
            "/api/admin-room/lead-map/pitch-deck/decks/\(deckId)/value-slide/for-lead",
            body: body
        )
    }

    func finalizePitchPresentation(id: String) async throws -> PitchFinalizeResponse {
        return try await post(
            "/api/admin-room/lead-map/pitch-deck/presentations/\(id)/finalize",
            body: [:]
        )
    }

    // MARK: Mockup-upload

    /// Last opp et bilde til en slide. Backend lagrer det under
    /// pitch-decks/{org_id}/{deck_id}/{slide_id}/{uuid}.{ext} på B2.
    /// data skal være JPEG eller PNG, maks 6 MB ferdig komprimert.
    func uploadPitchMockup(
        slideId: String, mimeType: String, data: Data
    ) async throws -> PitchAssetUploadResponse {
        let body: [String: Any] = [
            "mime": mimeType,
            "data_base64": data.base64EncodedString(),
            "asset_type": "mockup",
        ]
        return try await post(
            "/api/admin-room/lead-map/pitch-deck/slides/\(slideId)/mockup",
            body: body
        )
    }

    func deletePitchMockup(slideId: String, assetId: String) async throws {
        try await delete(
            "/api/admin-room/lead-map/pitch-deck/slides/\(slideId)/mockups/\(assetId)"
        )
    }

    /// Returnerer fresh signed URLs for alle assets i decket. iPad-en
    /// erstatter `asset://<id>` i slide.mockup_urls m/ disse URL-ene
    /// før AsyncImage tegner.
    func fetchPitchAssetUrls(deckId: String) async throws -> PitchAssetUrlsResponse {
        return try await get(
            "/api/admin-room/lead-map/pitch-deck/decks/\(deckId)/asset-urls"
        )
    }

    func updatePitchSlide(slideId: String, titleMd: String?, bodyMd: String?) async throws -> PitchSlideResponse {
        var body: [String: Any] = [:]
        if let t = titleMd { body["title_md"] = t }
        if let b = bodyMd  { body["body_md"]  = b }
        return try await patchReturning(
            "/api/admin-room/lead-map/pitch-deck/slides/\(slideId)",
            body: body
        )
    }

    func regeneratePitchSlide(slideId: String, instructions: String?) async throws -> PitchSlideResponse {
        let body: [String: Any] = ["instructions": instructions ?? ""]
        return try await post(
            "/api/admin-room/lead-map/pitch-deck/slides/\(slideId)/regenerate",
            body: body
        )
    }

    func lockPitchSlide(slideId: String, locked: Bool) async throws {
        try await post(
            "/api/admin-room/lead-map/pitch-deck/slides/\(slideId)/lock",
            body: ["locked": locked]
        )
    }

    /// Org-styrt visibility-toggle. Sliden bevares i decket men
    /// filtreres ut av PresentView + brief-anbefalinger.
    func setPitchSlideInclusion(slideId: String, included: Bool) async throws -> PitchSlideResponse {
        return try await patchReturning(
            "/api/admin-room/lead-map/pitch-deck/slides/\(slideId)",
            body: ["is_included": included]
        )
    }

    /// SOFT-DELETE. Sliden bevares i pitch_slides m/ deleted_at = now().
    /// UI viser angre-snackbar i 5 sek + "Slettede slides"-fane.
    func softDeletePitchSlide(slideId: String) async throws {
        try await delete(
            "/api/admin-room/lead-map/pitch-deck/slides/\(slideId)"
        )
    }

    func restorePitchSlide(slideId: String) async throws -> PitchSlideResponse {
        return try await post(
            "/api/admin-room/lead-map/pitch-deck/slides/\(slideId)/restore",
            body: [:]
        )
    }

    func fetchPitchTrash(deckId: String) async throws -> PitchTrashResponse {
        return try await get(
            "/api/admin-room/lead-map/pitch-deck/decks/\(deckId)/trash"
        )
    }

    func startPitchPresentation(deckId: String, leadId: String?) async throws -> PitchPresentationResponse {
        var body: [String: Any] = ["deck_id": deckId]
        if let l = leadId { body["lead_id"] = l }
        return try await post(
            "/api/admin-room/lead-map/pitch-deck/presentations",
            body: body
        )
    }

    func updatePitchPresentation(
        id: String,
        slidesShown: [String]? = nil,
        annotations: [String: Any]? = nil,
        outcome: PitchOutcome? = nil,
        outcomeNote: String? = nil,
        end: Bool = false
    ) async throws {
        var body: [String: Any] = [:]
        if let s = slidesShown   { body["slides_shown"] = s }
        if let a = annotations   { body["annotations"]  = a }
        if let o = outcome       { body["outcome"]      = o.rawValue }
        if let n = outcomeNote   { body["outcome_note"] = n }
        if end                   { body["end"] = true }
        try await patch(
            "/api/admin-room/lead-map/pitch-deck/presentations/\(id)",
            body: body
        )
    }

    /// Eksport — gated på pitch_deck.export. 403 om mangler.
    func exportPitchDeck(deckId: String, leadId: String?) async throws -> PitchExportResponse {
        var body: [String: Any] = ["deck_id": deckId]
        if let l = leadId { body["lead_id"] = l }
        return try await post(
            "/api/admin-room/lead-map/pitch-deck/exports",
            body: body
        )
    }

    // MARK: - Internal

    private func makeRequest(_ path: String, method: String = "GET") -> URLRequest {
        var req = URLRequest(url: baseURL.appendingPathComponent(path))
        req.httpMethod = method
        req.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        req.setValue("application/json", forHTTPHeaderField: "Content-Type")
        return req
    }

    private func get<T: Decodable>(_ path: String) async throws -> T {
        let req = makeRequest(path)
        let (data, response) = try await session.data(for: req)
        try Self.validate(response)
        return try Self.decoder.decode(T.self, from: data)
    }

    private func patch(_ path: String, body: [String: Any]) async throws {
        var req = makeRequest(path, method: "PATCH")
        req.httpBody = try JSONSerialization.data(withJSONObject: body)
        let (_, response) = try await session.data(for: req)
        try Self.validate(response)
    }

    private func patchReturning<T: Decodable>(_ path: String, body: [String: Any]) async throws -> T {
        var req = makeRequest(path, method: "PATCH")
        req.httpBody = try JSONSerialization.data(withJSONObject: body)
        let (data, response) = try await session.data(for: req)
        try Self.validate(response)
        return try Self.decoder.decode(T.self, from: data)
    }

    private func post<T: Decodable>(_ path: String, body: [String: Any]? = nil) async throws -> T {
        var req = makeRequest(path, method: "POST")
        if let body {
            req.httpBody = try JSONSerialization.data(withJSONObject: body)
        }
        let (data, response) = try await session.data(for: req)
        try Self.validate(response)
        return try Self.decoder.decode(T.self, from: data)
    }

    private func post(_ path: String, body: [String: Any]) async throws {
        var req = makeRequest(path, method: "POST")
        req.httpBody = try JSONSerialization.data(withJSONObject: body)
        let (_, response) = try await session.data(for: req)
        try Self.validate(response)
    }

    private func delete(_ path: String) async throws {
        let req = makeRequest(path, method: "DELETE")
        let (_, response) = try await session.data(for: req)
        try Self.validate(response)
    }

    private static func validate(_ response: URLResponse) throws {
        guard let http = response as? HTTPURLResponse else {
            throw APIError.invalidResponse
        }
        guard (200..<300).contains(http.statusCode) else {
            throw APIError.statusCode(http.statusCode)
        }
    }

    private static let decoder: JSONDecoder = {
        let d = JSONDecoder()
        d.keyDecodingStrategy = .convertFromSnakeCase
        d.dateDecodingStrategy = .iso8601
        return d
    }()
}

enum APIError: Error {
    case invalidResponse
    case statusCode(Int)
}

// MARK: - Response envelopes

private struct LeadsResponse: Decodable { let leads: [LeadModel] }
private struct ProjectsResponse: Decodable { let projects: [ProjectListItem] }
private struct CompetitorsResponse: Decodable { let competitors: [CompetitorModel] }
private struct CalendarResponse: Decodable { let events: [CalendarEvent] }
private struct EnrichmentEnvelope: Decodable { let enrichment: EnrichmentModel? }
private struct DemographicsEnvelope: Decodable { let demographics: DemographicsModel? }
private struct StrategyEnvelope: Decodable { let strategy: StrategyModel }
private struct OrgsResponse: Decodable { let organizations: [OrganizationSummary] }
private struct OrgProfilesResponse: Decodable { let profiles: [MemberProfile] }
private struct TeamsResponse: Decodable { let teams: [SalesTeam] }
private struct MemberLocationsResponse: Decodable { let locations: [MemberLocation] }
private struct ConsentResponse: Decodable { let consented: Bool }
private struct CreateAnnotationResponse: Decodable { let id: String }

struct OrgProfileEnvelope: Decodable {
    let profile: OrganizationProfile
    let canEdit: Bool
    let isOwner: Bool
    let ownerOnlyFields: [String]
}
