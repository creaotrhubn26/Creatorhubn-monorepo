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
    /// Statisk base-URL for kall som ikke trenger token (Google OAuth).
    static let baseURL = "https://creatorhub-backend-rtbl.onrender.com"

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

    // MARK: - Territorie-grids (LeadGrid territory enforcement)

    /// Kun den innloggede selgerens egne grids (for on-device geofence).
    func fetchMyTerritories(organizationId: String) async throws -> [Territory] {
        let resp: TerritoriesResponse = try await get(
            "/api/leadgrid/territories/mine?organization_id=\(organizationId)"
        )
        return resp.territories
    }

    /// Alle aktive grids i org-en (manager — for dekningskart).
    func fetchOrgTerritories(organizationId: String) async throws -> [Territory] {
        let resp: TerritoriesResponse = try await get(
            "/api/leadgrid/territories?organization_id=\(organizationId)")
        return resp.territories
    }

    /// Territorie-dekning for org-en (foreldreløse, overlapp, leads per grid).
    func fetchCoverage(organizationId: String) async throws -> CoverageResult? {
        let resp: CoverageResponse = try await get(
            "/api/leadgrid/territories/coverage?organization_id=\(organizationId)")
        return resp.coverage
    }

    /// Leder-dashboard: sone-ytelse per selger.
    func fetchTerritoryDashboard(
        organizationId: String, period: String = "last_30d"
    ) async throws -> TerritoryDashboardResponse {
        try await get(
            "/api/leadgrid/territories/dashboard?organization_id=\(organizationId)&period=\(period)")
    }

    /// Opprett en grid fra et tegnet polygon (Apple Pencil på iPad).
    /// Koordinatene lukkes til en GeoJSON-ring ([lng,lat]).
    func createTerritory(
        organizationId: String,
        name: String,
        assignedUserId: String?,
        polygon coords: [CLLocationCoordinate2D]
    ) async throws -> String {
        var ring = coords.map { [$0.longitude, $0.latitude] }
        if let first = ring.first, let last = ring.last,
           first[0] != last[0] || first[1] != last[1] {
            ring.append(first)
        }
        var body: [String: Any] = [
            "organization_id": organizationId,
            "name": name,
            "geometry": ["type": "Polygon", "coordinates": [ring]],
        ]
        if let u = assignedUserId { body["assigned_user_id"] = u }
        let resp: CreateTerritoryResponse = try await post(
            "/api/leadgrid/territories", body: body)
        return resp.id
    }

    // MARK: - Smart dagsrute

    /// Planlegg dagens rute blant selgerens in-grid leads.
    func planDayRoute(
        organizationId: String, startLat: Double, startLng: Double
    ) async throws -> DayRoutePlanResponse {
        let df = DateFormatter()
        df.dateFormat = "yyyy-MM-dd"
        return try await post("/api/leadgrid/routes/plan", body: [
            "organization_id": organizationId,
            "start_lat": startLat,
            "start_lng": startLng,
            "planned_date": df.string(from: Date()),
        ])
    }

    /// Oppdater status på et rute-stopp (innsjekk i felt).
    func updateRouteStop(
        routeId: String, stopId: String, status: String,
        outcome: String? = nil, notes: String? = nil
    ) async throws {
        var body: [String: Any] = ["status": status]
        if let o = outcome { body["outcome"] = o }
        if let n = notes { body["notes"] = n }
        try await patch("/api/leadgrid/routes/\(routeId)/stops/\(stopId)", body: body)
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

    // MARK: - Min profil (PR #761+)

    /// Hent min egen profil (de 4 påkrevde feltene: avatar/e-post/telefon/profesjon).
    func fetchMyProfile() async throws -> MyProfileResponse {
        try await get("/api/admin-room/lead-map/me/profile")
    }

    /// Patch én eller flere profil-felter.
    func patchMyProfile(_ updates: [String: String?]) async throws -> MyProfileResponse {
        var body: [String: Any] = [:]
        for (k, v) in updates {
            body[k] = v ?? NSNull()
        }
        return try await patchReturning("/api/admin-room/lead-map/me/profile", body: body)
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

    // MARK: - Lead Research (gated på lead_research.run)

    func startLeadResearch(
        industry: String, region: String,
        targetAudience: String?, goal: String?,
        organizationId: String?
    ) async throws -> LeadResearchStartResponse {
        var body: [String: Any] = [
            "industry": industry,
            "region": region,
        ]
        if let t = targetAudience, !t.isEmpty { body["target_audience"] = t }
        if let g = goal, !g.isEmpty           { body["goal"] = g }
        if let o = organizationId             { body["organization_id"] = o }
        return try await post(
            "/api/admin-room/lead-map/research/start",
            body: body
        )
    }

    func runLeadResearch(researchId: String) async throws {
        try await post(
            "/api/admin-room/lead-map/research/\(researchId)/run",
            body: [:]
        )
    }

    func fetchLeadResearchStatus(researchId: String) async throws -> LeadResearchStatusResponse {
        return try await get(
            "/api/admin-room/lead-map/research/\(researchId)"
        )
    }

    // MARK: - Lead Scout (needs/signals/scores)

    func fetchLeadNeedsOverview(leadId: String) async throws -> LeadNeedsOverviewResponse {
        return try await get(
            "/api/admin-room/lead-map/leads/\(leadId)/needs-overview"
        )
    }

    func runScoutForLead(leadId: String) async throws -> LeadScoutResult {
        return try await post(
            "/api/admin-room/lead-map/leads/\(leadId)/scout",
            body: [:]
        )
    }

    // MARK: - Portefølje

    func fetchPortfolio(orgId: String, sort: String) async throws -> PortfolioResponse {
        return try await get(
            "/api/admin-room/lead-map/organizations/\(orgId)/portfolio?sort=\(sort)"
        )
    }

    // MARK: - Selv-onboarding + Focus requests + Playbooks

    func autoOnboardCustomer(
        websiteUrl: String, contactEmail: String,
        contactName: String?, contactPhone: String?,
        organizationId: String, presetId: String?
    ) async throws -> AutoOnboardResponse {
        var body: [String: Any] = [
            "website_url": websiteUrl,
            "contact_email": contactEmail,
            "organization_id": organizationId,
        ]
        if let n = contactName  { body["contact_name"] = n }
        if let p = contactPhone { body["contact_phone"] = p }
        if let id = presetId    { body["preset_id"] = id }
        return try await post(
            "/api/admin-room/lead-map/customers/auto-onboard", body: body
        )
    }

    func fetchAutoOnboardStatus(auditId: String) async throws -> AutoOnboardStatusResponse {
        return try await get(
            "/api/admin-room/lead-map/customers/auto-onboard/\(auditId)"
        )
    }

    func fetchFocusRequests(orgId: String, status: String?) async throws -> FocusRequestsResponse {
        var path = "/api/admin-room/lead-map/focus-requests?organization_id=\(orgId)"
        if let s = status { path += "&status=\(s)" }
        return try await get(path)
    }

    func startDeliveryFromFocusRequest(focusRequestId: String) async throws -> StartDeliveryResponse {
        return try await post(
            "/api/admin-room/lead-map/focus-requests/\(focusRequestId)/start-delivery",
            body: [:]
        )
    }

    func fetchDeliverable(deliverableId: String) async throws -> DeliverableResponse {
        return try await get(
            "/api/admin-room/lead-map/deliverables/\(deliverableId)"
        )
    }

    func updateDeliverableStep(
        deliverableId: String, stepNumber: Int, status: String, notes: String?
    ) async throws -> DeliverableResponse {
        var body: [String: Any] = [
            "step_number": stepNumber,
            "status": status,
        ]
        if let n = notes { body["notes"] = n }
        return try await patchReturning(
            "/api/admin-room/lead-map/deliverables/\(deliverableId)/step",
            body: body
        )
    }

    func toggleDeliverableRequirement(
        deliverableId: String, requirementIndex: Int, received: Bool
    ) async throws -> DeliverableResponse {
        return try await patchReturning(
            "/api/admin-room/lead-map/deliverables/\(deliverableId)/step",
            body: ["requirement_index": requirementIndex, "received": received]
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

    // ============================================================
    // MARK: - Leadgrid v2 (web Leadgrid-paritet)
    //
    // Disse går mot /api/leadgrid/* endepunkter, som er det nyere
    // Leadgrid-system m/ hierarkisk tildeling, won/lost m/ detaljer,
    // sett-tracking, scheduled reports og notification-prefs.
    // ============================================================

    // -- Status-flow ----------------------------------------------

    /// Endre status. For won må man sende beløp; for lost må man sende reason.
    func updateLeadgridStatus(
        customerId: String, toStatus: String, note: String? = nil,
        wonAmountOere: Int? = nil, wonRecurringOere: Int? = nil, wonNote: String? = nil,
        lostReason: String? = nil, lostReasonDetail: String? = nil
    ) async throws {
        var body: [String: Any] = ["to_status": toStatus]
        if let n = note { body["note"] = n }
        if let v = wonAmountOere { body["won_amount_oere"] = v }
        if let v = wonRecurringOere { body["won_recurring_oere"] = v }
        if let v = wonNote { body["won_note"] = v }
        if let v = lostReason { body["lost_reason"] = v }
        if let v = lostReasonDetail { body["lost_reason_detail"] = v }
        try await put("/api/leadgrid/customers/\(customerId)/status", body: body)
    }

    func fetchLeadgridStatusHistory(customerId: String) async throws -> StatusHistoryResponse {
        try await get("/api/leadgrid/customers/\(customerId)/status-history")
    }

    // -- Hierarkisk tildeling -------------------------------------

    /// Henter tildelbare brukere med workload-info.
    /// role-parameter: "team_leader" | "rep" | "all"
    func fetchAssignableUsers(role: String = "all") async throws -> AssignableUsersResponse {
        try await get("/api/leadgrid/assignable-users?role=\(role)")
    }

    func assignTeamLeader(
        customerId: String, teamLeaderUserId: String, note: String? = nil
    ) async throws {
        var body: [String: Any] = ["team_leader_user_id": teamLeaderUserId]
        if let n = note { body["note"] = n }
        try await post("/api/leadgrid/customers/\(customerId)/assign-team-leader", body: body)
    }

    func assignRep(
        customerId: String, repUserId: String, note: String? = nil
    ) async throws {
        var body: [String: Any] = ["rep_user_id": repUserId]
        if let n = note { body["note"] = n }
        try await post("/api/leadgrid/customers/\(customerId)/assign-rep", body: body)
    }

    func unassign(customerId: String, unassignType: String = "rep") async throws {
        try await post("/api/leadgrid/customers/\(customerId)/unassign",
                        body: ["unassign_type": unassignType])
    }

    // -- Sett-tracking --------------------------------------------

    /// Marker en lead som sett (kalles automatisk når selger åpner LeadDetailView).
    func markLeadSeen(customerId: String) async throws {
        try await post("/api/leadgrid/customers/\(customerId)/mark-seen", body: [:])
    }

    func fetchAssignmentStatus(customerId: String) async throws -> AssignmentStatusResponse {
        try await get("/api/leadgrid/customers/\(customerId)/assignment-status")
    }

    // -- Mine tildelinger -----------------------------------------

    func fetchMyAssignments() async throws -> MyAssignmentsResponse {
        try await get("/api/leadgrid/my-assignments")
    }

    // -- Lead-detail ----------------------------------------------

    func fetchLeadgridCustomer(customerId: String) async throws -> LeadgridCustomerDetail {
        try await get("/api/leadgrid/customers/\(customerId)")
    }

    // -- Won/Lost-stats -------------------------------------------

    /// period: "7d" | "30d" | "90d"
    func fetchWonLostStats(period: String = "30d") async throws -> WonLostStatsResponse {
        try await get("/api/leadgrid/won-lost-stats?period=\(period)")
    }

    // -- Notification-prefs (intern) ------------------------------

    func fetchMyLeadgridNotificationPrefs() async throws -> LeadgridNotificationPrefs {
        try await get("/api/leadgrid/my-notification-prefs")
    }

    func updateMyLeadgridNotificationPrefs(_ prefs: [String: Any]) async throws {
        try await put("/api/leadgrid/my-notification-prefs", body: prefs)
    }

    // -- In-app notifications -------------------------------------

    func fetchMyLeadgridNotifications() async throws -> LeadgridNotificationsResponse {
        try await get("/api/leadgrid/my-notifications")
    }

    func markLeadgridNotificationsRead(ids: [String] = []) async throws {
        try await post("/api/leadgrid/my-notifications/mark-read",
                        body: ["ids": ids])
    }

    // -- Schedulerte rapporter ------------------------------------

    func fetchScheduledReports() async throws -> ScheduledReportsResponse {
        try await get("/api/leadgrid/scheduled-reports")
    }

    func createScheduledReport(_ payload: [String: Any]) async throws {
        try await post("/api/leadgrid/scheduled-reports", body: payload)
    }

    func updateScheduledReport(id: String, payload: [String: Any]) async throws {
        try await put("/api/leadgrid/scheduled-reports/\(id)", body: payload)
    }

    func deleteScheduledReport(id: String) async throws {
        try await delete("/api/leadgrid/scheduled-reports/\(id)")
    }

    func sendScheduledReportNow(id: String) async throws {
        try await post("/api/leadgrid/scheduled-reports/\(id)/send-now", body: [:])
    }

    func autoCreateReportsPerPerson() async throws -> AutoCreateReportsResponse {
        try await post(
            "/api/leadgrid/scheduled-reports/auto-create-for-team",
            body: ["frequency": "weekly", "day_of_week": 1, "time_of_day": "08:00",
                    "period_days": 7, "report_type": "summary",
                    "include_reps": true, "include_team_leaders": true]
        )
    }

    // -- Klient-onboarding for varslings-kanaler (PR #737) --------

    func fetchOnboardingChannelState() async throws -> ChannelOnboardingStateResponse {
        try await get("/api/leadgrid/onboarding/channels/state")
    }

    func selectOnboardingModel(_ model: String) async throws {
        try await put("/api/leadgrid/onboarding/channels/model",
                       body: ["model": model])
    }

    func advanceOnboardingStep(fromStep: String) async throws -> AdvanceOnboardingResponse {
        try await post("/api/leadgrid/onboarding/channels/advance",
                        body: ["from_step": fromStep])
    }

    /// Send test-melding (e-post + WA) til en gitt mottaker via notifyClient.
    func sendOnboardingTest(
        phone: String?, email: String?, name: String?
    ) async throws -> OnboardingTestResponse {
        var body: [String: Any] = [:]
        if let phone { body["phone"] = phone }
        if let email { body["email"] = email }
        if let name { body["name"] = name }
        return try await post("/api/leadgrid/onboarding/channels/test-send",
                                body: body)
    }

    func activateOnboarding() async throws {
        try await post("/api/leadgrid/onboarding/channels/activate", body: [:])
    }

    // -- CSV-eksport (returnerer rådata) ---------------------------

    /// Returnerer CSV-data klar for å vises i UIActivityViewController/iOS Share.
    func exportLeadsCsv(period: String = "30d", status: String = "all") async throws -> Data {
        var req = makeRequest(
            "/api/leadgrid/leads/export?format=csv&period=\(period)&status=\(status)",
            method: "GET",
        )
        let (data, response) = try await session.data(for: req)
        try Self.validate(response)
        return data
    }

    /// KPI-summary for export-knapp (antall + period). Brukes for å vise
    /// "Eksporterer 142 leads fra siste 30 dager" før shareSheet.
    func fetchLeadsExportSummary(period: String = "30d", status: String = "all") async throws -> LeadsExportSummary {
        try await get("/api/leadgrid/leads/export-summary?period=\(period)&status=\(status)")
    }

    // -- Plan-quota (Fase 16: PlanUsageBar i HubView) ---------------

    /// Henter plan-summary for org-en: nåværende plan + grace + limits +
    /// usage (customers_active, auto_onboards_this_month) + pct (0-100).
    /// Brukes for å vise plan-bar øverst i HubView.
    func fetchLeadgridPlanSummary(orgId: String) async throws -> LeadgridPlanSummary {
        try await get("/api/leadgrid/plan/summary?orgId=\(orgId)")
    }

    // -- Assignment-historikk (Fase 16: vis hvem som har eid leaden) -

    /// Liste over tildelinger på en lead: hvem tildelte hvem, når, hvorfor.
    /// Brukes i CustomerDetail som tilleggsfane ved siden av status-history.
    func fetchAssignmentHistory(customerId: String) async throws -> AssignmentHistoryResponse {
        try await get("/api/leadgrid/customers/\(customerId)/assignment-history")
    }

    // -- Onboarding-state (Fase 16: org-overordnet wizard) -----------

    /// Hent org-overordnet onboarding-state (har de fullført wizard?).
    func fetchOnboardingState() async throws -> LeadgridOnboardingState {
        try await get("/api/leadgrid/onboarding/state")
    }

    /// Avansere onboarding-wizard fra steg X → Y.
    func advanceOnboarding(fromStep: String) async throws {
        try await post("/api/leadgrid/onboarding/advance",
                       body: ["from_step": fromStep])
    }

    /// Skip wizard (markerer den som fullført uten å fullføre alle steg).
    func skipOnboarding() async throws {
        try await post("/api/leadgrid/onboarding/skip", body: [:])
    }

    // -- Billing (Fase 16: faktura-historikk + Stripe portal) --------

    /// Liste over fakturaer for org-en (fra Stripe). Markedssjef kan se
    /// status + beløp i felt før møte.
    func fetchLeadgridBillingInvoices() async throws -> LeadgridBillingInvoicesResponse {
        try await get("/api/leadgrid/billing/invoices")
    }

    /// Generer Stripe billing-portal-session — returnerer URL som åpnes
    /// i Safari for å oppdatere betalingsmetode/se historikk.
    func createBillingPortalSession() async throws -> BillingPortalSessionResponse {
        try await post("/api/leadgrid/billing/portal-session", body: [:])
    }

    // -- Partners (Fase 16: Partner-program landing-strip) -----------

    /// Liste over godkjente partnere (offentlig endepunkt). Brukes for å
    /// vise "Powered by"-strip + Partners-fane.
    func fetchLeadgridPartners(type: String? = nil) async throws -> LeadgridPartnersResponse {
        let qs = type.map { "?type=\($0)" } ?? ""
        return try await get("/api/leadgrid/partners\(qs)")
    }

    // -- Klient-portal-varsler (Fase 17: klient-side notif-prefs) ----

    /// Klient-portal notification-prefs (per portalToken, ikke session).
    func fetchClientPortalNotificationPrefs(portalToken: String) async throws -> ClientPortalNotificationPrefs {
        try await get("/api/leadgrid/portal/\(portalToken)/notification-prefs")
    }

    /// Oppdater klient-portal notification-prefs.
    func updateClientPortalNotificationPrefs(
        portalToken: String,
        payload: [String: Any],
    ) async throws {
        try await patch("/api/leadgrid/portal/\(portalToken)/notification-prefs", body: payload)
    }

    // ============================================================
    // MARK: - Leadgrid Market Scan (PR #851)
    //
    // Native markedssjef-lead-discovery via Claude + BRREG + Places.
    // Backend gjenbruker market-scan-service.ts under panseret og
    // auto-oppretter crm_customers med lat/lng = pin på Kart-tab.
    // RBAC: leadgrid.market_scan.run.
    //
    // NB: Funksjons- og type-navnene er prefikset `Leadgrid…` for å
    // unngå kollisjon med eksisterende `fetchMarketScans()` /
    // `MarketScan*` for det eldre /api/market-scans-endepunktet (brukt
    // av SuperAdminFase22Views).
    // ============================================================

    /// Historikk over alle scans innlogget bruker har kjørt
    /// (sortert nyeste først, maks 30).
    func fetchLeadgridMarketScans() async throws -> [LeadgridMarketScan] {
        let resp: LeadgridMarketScanListResponse = try await get(
            "/api/leadgrid/market-scan"
        )
        return resp.scans
    }

    /// Hent én scan med tilhørende konkurrenter + muligheter.
    /// Backend har separate endepunkter, så vi henter alt parallelt
    /// og pakker det inn i et LeadgridMarketScanDetail.
    func fetchLeadgridMarketScan(id: String) async throws -> LeadgridMarketScanDetail {
        async let scan: LeadgridMarketScanProgressResponse = get(
            "/api/leadgrid/market-scan/\(id)"
        )
        async let competitors: LeadgridMarketScanCompetitorsResponse = get(
            "/api/leadgrid/market-scan/\(id)/competitors"
        )
        async let opportunities: LeadgridMarketScanOpportunitiesResponse = get(
            "/api/leadgrid/market-scan/\(id)/opportunities"
        )
        let (s, c, o) = try await (scan, competitors, opportunities)
        return LeadgridMarketScanDetail(
            scan: s.scan,
            competitors: c.competitors,
            opportunities: o.opportunities,
        )
    }

    /// Letvekts status-poll for detail-view (henter kun scan-progress —
    /// competitors/opportunities oppdateres separat når status=completed).
    func fetchLeadgridMarketScanProgress(id: String) async throws -> LeadgridMarketScan {
        let resp: LeadgridMarketScanProgressResponse = try await get(
            "/api/leadgrid/market-scan/\(id)"
        )
        return resp.scan
    }

    /// Kicker orkestratoren — returnerer ny scan-rad fra DB via
    /// progress-poll (backend's run-endepunkt sender bare {scanId, name}).
    func runLeadgridMarketScan(input: RunLeadgridMarketScanInput) async throws -> LeadgridMarketScan {
        var body: [String: Any] = [
            "industry": input.industry.trimmingCharacters(in: .whitespaces),
            "region":   input.region.trimmingCharacters(in: .whitespaces),
            "auto_create_leads": input.autoCreateLeads,
        ]
        let trimmedName = input.name.trimmingCharacters(in: .whitespaces)
        if !trimmedName.isEmpty { body["name"] = trimmedName }
        let trimmedAudience = input.targetAudience.trimmingCharacters(in: .whitespaces)
        if !trimmedAudience.isEmpty { body["target_audience"] = trimmedAudience }
        let trimmedGoal = input.goal.trimmingCharacters(in: .whitespaces)
        if !trimmedGoal.isEmpty { body["goal"] = trimmedGoal }
        if let orgId = input.organizationId, !orgId.isEmpty {
            body["organization_id"] = orgId
        }
        let runResp: LeadgridMarketScanRunResponse = try await post(
            "/api/leadgrid/market-scan/run",
            body: body,
        )
        // Hent kanonisk scan-rad så caller får hele Leadgrid-Market-Scan-shape.
        return try await fetchLeadgridMarketScanProgress(id: runResp.scanId)
    }

    /// Manuell trigger for å auto-opprette leads etter en scan som
    /// kjørte med auto_create_leads=false. Returnerer oppdatert scan
    /// (med ny leads_created_count).
    @discardableResult
    func createLeadgridLeadsFromScan(id: String) async throws -> LeadgridMarketScan {
        let _: LeadgridMarketScanCreateLeadsResponse = try await post(
            "/api/leadgrid/market-scan/\(id)/create-leads",
            body: [:],
        )
        return try await fetchLeadgridMarketScanProgress(id: id)
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

    private func put(_ path: String, body: [String: Any]) async throws {
        var req = makeRequest(path, method: "PUT")
        req.httpBody = try JSONSerialization.data(withJSONObject: body)
        let (_, response) = try await session.data(for: req)
        try Self.validate(response)
    }

    private func put<T: Decodable>(_ path: String, body: [String: Any]) async throws -> T {
        var req = makeRequest(path, method: "PUT")
        req.httpBody = try JSONSerialization.data(withJSONObject: body)
        let (data, response) = try await session.data(for: req)
        try Self.validate(response)
        return try Self.decoder.decode(T.self, from: data)
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

// MARK: - Fase 18: Super-admin endpoints

extension APIClient {

    // -- /api/auth/user (rolle-deteksjon) ---------------------------

    /// Hent innlogget bruker m/ role + permissions. Brukes ved app-start
    /// for å detektere super_admin og låse opp SuperAdminHub.
    func fetchAuthUser() async throws -> AuthUserResponse {
        try await get("/api/auth/user")
    }

    // -- Agency-leads (B2B Leadgrid-pipeline) -----------------------

    /// Liste markedssjef-leads (prospekter for Leadgrid). Filter på status.
    func fetchAgencyLeads(status: String? = nil) async throws -> AgencyLeadsResponse {
        let qs = status.map { "?status=\($0)" } ?? ""
        return try await get("/api/admin-room/agency-leads\(qs)")
    }

    /// Hent enkel agency-lead detalj.
    func fetchAgencyLead(id: String) async throws -> AgencyLead {
        try await get("/api/admin-room/agency-leads/\(id)")
    }

    /// Oppdater status / interne notater / assignment.
    func updateAgencyLead(id: String, payload: [String: Any]) async throws {
        try await patch("/api/admin-room/agency-leads/\(id)", body: payload)
    }

    /// Konverter lead til kunde — sender selvbetjent onboarding-lenke
    /// til kontakten.
    func convertAgencyLeadToCustomer(
        id: String, persona: String, sendEmail: Bool,
    ) async throws -> AgencyLeadConvertResponse {
        try await post(
            "/api/admin-room/agency-leads/\(id)/convert-to-customer",
            body: ["persona": persona, "sendEmail": sendEmail],
        )
    }

    // -- WhatsApp templates -----------------------------------------

    func fetchWaTemplates(orgKey: String? = nil) async throws -> WaTemplatesResponse {
        let qs = orgKey.map { "?org_key=\($0)" } ?? ""
        return try await get("/api/superadmin/wa-templates\(qs)")
    }

    func deleteWaTemplate(name: String, orgKey: String? = nil) async throws {
        let qs = orgKey.map { "?org_key=\($0)" } ?? ""
        let encoded = name.addingPercentEncoding(withAllowedCharacters: .urlPathAllowed) ?? name
        try await delete("/api/superadmin/wa-templates/\(encoded)\(qs)")
    }

    func sendWaTemplateTest(name: String, phone: String, params: [String]?) async throws {
        var body: [String: Any] = ["phone": phone]
        if let params { body["params"] = params }
        let encoded = name.addingPercentEncoding(withAllowedCharacters: .urlPathAllowed) ?? name
        try await post("/api/superadmin/wa-templates/\(encoded)/send-test", body: body)
    }

    func fetchWaTemplateAnalytics() async throws -> WaTemplateAnalyticsResponse {
        try await get("/api/superadmin/wa-templates/analytics")
    }

    func syncWaTemplatesFromMeta() async throws {
        try await post("/api/superadmin/wa-templates/sync-from-meta", body: [:])
    }

    func syncWaTemplatesToLeadgrid() async throws {
        try await post("/api/superadmin/wa-templates/sync-leadgrid", body: [:])
    }

    // -- WhatsApp Org configs ---------------------------------------

    func fetchWaOrgConfigs() async throws -> WaOrgConfigsResponse {
        try await get("/api/superadmin/wa-org-configs")
    }

    func updateWaOrgConfig(orgKey: String, payload: [String: Any]) async throws {
        let encoded = orgKey.addingPercentEncoding(withAllowedCharacters: .urlPathAllowed) ?? orgKey
        try await patch("/api/superadmin/wa-org-configs/\(encoded)", body: payload)
    }

    func deleteWaOrgConfig(orgKey: String) async throws {
        let encoded = orgKey.addingPercentEncoding(withAllowedCharacters: .urlPathAllowed) ?? orgKey
        try await delete("/api/superadmin/wa-org-configs/\(encoded)")
    }

    // -- Partners + applications ------------------------------------

    func fetchSuperAdminPartners() async throws -> SuperAdminPartnersResponse {
        try await get("/api/superadmin/partners")
    }

    func revokePartner(id: String) async throws {
        try await post("/api/superadmin/partners/\(id)/revoke", body: [:])
    }

    func fetchPartnerApplications(status: String = "pending") async throws -> PartnerApplicationsResponse {
        try await get("/api/superadmin/partner-applications?status=\(status)")
    }

    func approvePartnerApplication(id: String, notes: String?) async throws {
        var body: [String: Any] = [:]
        if let notes { body["notes"] = notes }
        try await post("/api/superadmin/partner-applications/\(id)/approve", body: body)
    }

    func rejectPartnerApplication(id: String, reason: String?) async throws {
        var body: [String: Any] = [:]
        if let reason { body["reason"] = reason }
        try await post("/api/superadmin/partner-applications/\(id)/reject", body: body)
    }

    // -- Email branding (per org) -----------------------------------

    func fetchEmailBrandingConfigs() async throws -> EmailBrandingResponse {
        try await get("/api/superadmin/email-branding")
    }

    func updateEmailBranding(orgKey: String, payload: [String: Any]) async throws {
        let encoded = orgKey.addingPercentEncoding(withAllowedCharacters: .urlPathAllowed) ?? orgKey
        try await patch("/api/superadmin/email-branding/\(encoded)", body: payload)
    }

    // -- API keys + webhooks ----------------------------------------

    func fetchSuperAdminApiKeys() async throws -> LeadgridApiKeysResponse {
        try await get("/api/superadmin/api-keys")
    }

    func revokeApiKey(id: String) async throws {
        try await post("/api/superadmin/api-keys/\(id)/revoke", body: [:])
    }

    func fetchWebhookEndpoints() async throws -> WebhookEndpointsResponse {
        try await get("/api/superadmin/webhook-endpoints")
    }

    func testWebhookEndpoint(id: String) async throws {
        try await post("/api/superadmin/webhook-endpoints/\(id)/test", body: [:])
    }

    func deleteWebhookEndpoint(id: String) async throws {
        try await delete("/api/superadmin/webhook-endpoints/\(id)")
    }

    func fetchWebhookDeliveries(endpointId: String? = nil) async throws -> WebhookDeliveriesResponse {
        let qs = endpointId.map { "?endpoint_id=\($0)" } ?? ""
        return try await get("/api/superadmin/webhook-deliveries\(qs)")
    }

    // -- TestFlight testers -----------------------------------------

    func fetchTestflightTesters() async throws -> TestflightTestersResponse {
        try await get("/api/superadmin/testflight-testers")
    }

    func syncTestflightTestersFromAsc() async throws {
        try await post("/api/superadmin/testflight-testers/sync-asc", body: [:])
    }

    func graduateTestflightTester(id: String) async throws {
        try await post("/api/superadmin/testflight-testers/\(id)/graduate", body: [:])
    }

    func removeTestflightTester(id: String) async throws {
        try await post("/api/superadmin/testflight-testers/\(id)/remove", body: [:])
    }

    func fetchAscHealth() async throws -> AscHealthResponse {
        try await get("/api/superadmin/testflight-testers/asc-health")
    }

    // -- Notification log + onboarding-funnel + payments + overage --

    func fetchSuperAdminNotificationLog(limit: Int = 100) async throws -> NotificationLogResponse {
        try await get("/api/superadmin/notification-log?limit=\(limit)")
    }

    func fetchOnboardingFunnel() async throws -> OnboardingFunnelResponse {
        try await get("/api/superadmin/onboarding-funnel")
    }

    func fetchPaymentsOverview() async throws -> PaymentOverviewResponse {
        try await get("/api/superadmin/payments-overview")
    }

    func fetchOverageStats() async throws -> OverageStatsResponse {
        try await get("/api/superadmin/overage-stats")
    }
}

// MARK: - Fase 19: Resterende admin-room paritet

extension APIClient {

    // -- RBAC permissions-matrise (per org) -----------------------

    /// Liste over alle role-keys + default permissions + medlemmer per rolle.
    /// Brukes i SuperAdminPermissionsMatrixView for å vise full RBAC-grid.
    func fetchPermissionsMatrix(orgId: String) async throws -> PermissionsMatrixResponse {
        try await get("/api/admin-room/lead-map/organizations/\(orgId)/role-defaults")
    }

    // -- Promote-medlem (sales-hierarki) --------------------------

    /// Forhåndsvis hva som skjer hvis vi forfremmer member til toRole.
    func previewPromotion(orgId: String, userId: String, toRole: String) async throws -> PromotionPreview {
        try await get(
            "/api/admin-room/lead-map/organizations/\(orgId)/members/\(userId)/promotion-preview?to_role=\(toRole)"
        )
    }

    /// Bekreft forfremmelse til ny rolle.
    func promoteMember(orgId: String, userId: String, toRole: String, reason: String?) async throws {
        var body: [String: Any] = ["to_role": toRole]
        if let reason { body["reason"] = reason }
        try await post(
            "/api/admin-room/lead-map/organizations/\(orgId)/members/\(userId)/promote",
            body: body,
        )
    }

    /// Liste alle medlemmer i org for promote-flyten.
    func fetchOrgMembersForPromote(orgId: String) async throws -> OrgMembersResponse {
        try await get("/api/admin-room/lead-map/organizations/\(orgId)/members")
    }

    // -- Customer Success ----------------------------------------

    func fetchCustomerSuccessDashboard() async throws -> CSDashboardSummary {
        try await get("/api/admin-room/customer-success/dashboard")
    }

    func fetchCSRenewals(daysAhead: Int = 90, status: String? = nil) async throws -> CSRenewalsResponse {
        var qs = "?days=\(daysAhead)"
        if let status { qs += "&status=\(status)" }
        return try await get("/api/admin-room/customer-success/renewals\(qs)")
    }

    func updateRenewalStatus(id: String, payload: [String: Any]) async throws {
        try await patch("/api/admin-room/customer-success/renewals/\(id)", body: payload)
    }

    // -- B2B Cockpit (Daniel's egen B2B-funnel) -------------------

    func fetchB2BFunnel(arpuMonthlyNok: Double? = nil) async throws -> B2BFunnelResponse {
        let qs = arpuMonthlyNok.map { "?arpuMonthlyNok=\($0)" } ?? ""
        return try await get("/api/admin-room/cockpit/b2b/funnel\(qs)")
    }

    // -- LinkedIn Cockpit ----------------------------------------

    func fetchLinkedInCapiStatus() async throws -> LinkedInCapiStatus {
        try await get("/api/admin-room/cockpit/linkedin/capi/status")
    }

    func fetchLinkedInLeadSyncStatus() async throws -> LinkedInLeadSyncStatus {
        try await get("/api/admin-room/cockpit/linkedin/leadsync/status")
    }

    func triggerLinkedInCapiSendDue() async throws {
        try await post("/api/admin-room/cockpit/linkedin/capi/send-due", body: [:])
    }

    func triggerLinkedInLeadSyncPoll() async throws {
        try await post("/api/admin-room/cockpit/linkedin/leadsync/poll-now", body: [:])
    }

    func fetchLinkedInCockpitOrgs() async throws -> LinkedInCockpitOrgsResponse {
        try await get("/api/admin-room/cockpit/linkedin/orgs")
    }

    func setLinkedInCockpitDefaultOrg(id: String) async throws {
        try await post("/api/admin-room/cockpit/linkedin/orgs/\(id)/default", body: [:])
    }

    // -- Case Studies --------------------------------------------

    func fetchCaseStudies() async throws -> CaseStudiesResponse {
        try await get("/api/admin-room/cockpit/case-studies")
    }

    func generateCaseStudy(customerId: String) async throws {
        try await post("/api/admin-room/cockpit/case-studies/generate",
                        body: ["customerId": customerId])
    }

    // -- Role Nav Config -----------------------------------------

    func fetchRoleNavConfigs() async throws -> RoleNavConfigsResponse {
        try await get("/api/admin-room/role-nav-config")
    }

    func updateRoleNavConfig(role: String, payload: [String: Any]) async throws {
        try await patch("/api/admin-room/role-nav-config/\(role)", body: payload)
    }
}

// MARK: - Fase 20: Platform-status + integrations + API-endpoints-health

extension APIClient {

    /// Aggregert plattform-helse: Render + Neon + Vercel + Stripe + Anthropic + bruker-presence.
    func fetchPlatformStatus() async throws -> PlatformStatusResponse {
        try await get("/api/admin-room/platform-status")
    }

    /// Daniel's integrations-oversikt: totalt antall, aktive, ødelagte, per kategori.
    func fetchIntegrationsOverview() async throws -> IntegrationsOverview {
        try await get("/api/admin/integrations/overview")
    }

    /// Alle integrasjons-keys (Stripe/Meta/LinkedIn/AI-providers/osv).
    func fetchIntegrationKeys() async throws -> IntegrationKeysResponse {
        try await get("/api/admin/integrations/keys")
    }

    /// Webhook-endepunkter på tvers av integrations (annet enn superadmin-webhooks).
    func fetchIntegrationWebhooks() async throws -> IntegrationWebhooksResponse {
        try await get("/api/admin/integrations/webhooks")
    }

    /// API-endepunkt-helse — feil/warning/info-tellere per source siste 24t.
    func fetchApiEndpointsHealth() async throws -> ApiEndpointsHealthResponse {
        try await get("/api/admin/api-endpoints/health")
    }
}

// MARK: - Fase 21: Resterende admin-room-paritet

extension APIClient {

    // -- Leads growth (B2B + per-org månedlig vekst) ---------------

    func fetchLeadsGrowth(period: String = "12m", scope: String = "b2b") async throws -> LeadsGrowthResponse {
        try await get("/api/admin-room/leads-growth?period=\(period)&scope=\(scope)")
    }

    // -- Social connections status ---------------------------------

    func fetchSocialConnectionsStatus(orgId: String? = nil) async throws -> SocialConnectionsStatusResponse {
        let qs = orgId.map { "?orgId=\($0)" } ?? ""
        return try await get("/api/admin-room/social-connections/status\(qs)")
    }

    // -- Competitor report (Claude SWOT per konkurrent) ------------

    func fetchCompetitorReport(competitorId: String) async throws -> CompetitorReportResponse {
        try await get("/api/admin-room/lead-map/leads/\(competitorId)/competitor-report")
    }

    // -- Resend status ---------------------------------------------

    func fetchResendStatus() async throws -> ResendStatusResponse {
        try await get("/api/admin-room/resend/status")
    }

    // -- Post drafts (eksisterende endpoint) -----------------------

    func fetchPostDrafts(status: String? = nil, platform: String? = nil) async throws -> MarketingPostDraftsResponse {
        var qs: [String] = []
        if let status { qs.append("status=\(status)") }
        if let platform { qs.append("platform=\(platform)") }
        let q = qs.isEmpty ? "" : "?" + qs.joined(separator: "&")
        return try await get("/api/role-room/agent/post-drafts\(q)")
    }

    func deletePostDraft(id: String) async throws {
        try await delete("/api/role-room/agent/post-drafts/\(id)")
    }

    func publishPostDraft(id: String) async throws {
        try await post("/api/role-room/agent/post-drafts/\(id)/publish", body: [:])
    }

    // -- Content calendar (eksisterende endpoint) ------------------

    func fetchContentCalendar(brandKey: String? = nil) async throws -> ContentCalendarResponse {
        let qs = brandKey.map { "?brandKey=\($0)" } ?? ""
        return try await get("/api/role-room/marketing-cockpit/content-calendar\(qs)")
    }

    // -- What's new (eksisterende endpoint) ------------------------

    func fetchWhatsNew() async throws -> WhatsNewResponse {
        try await get("/api/admin-room/whats-new")
    }

    func fetchPublicWhatsNew() async throws -> WhatsNewResponse {
        try await get("/api/whats-new")
    }

    // -- B2 Archive (eksisterende endpoint) ------------------------

    func fetchB2ArchiveUsage(roleRoom: Bool = false) async throws -> B2ArchiveUsage {
        let path = roleRoom ? "/api/role-room/admin/b2-archive/usage" : "/api/admin/b2-archive/usage"
        return try await get(path)
    }

    func fetchB2ArchiveFiles(roleRoom: Bool = false) async throws -> B2ArchiveFilesResponse {
        let path = roleRoom ? "/api/role-room/admin/b2-archive/files" : "/api/admin/b2-archive/files"
        return try await get(path)
    }

    // -- Migrations status (eksisterende endpoint) -----------------

    func fetchMigrationsStatus() async throws -> MigrationsStatus {
        try await get("/api/admin-room/migrations/status")
    }

    func runMigrations() async throws {
        try await post("/api/admin-room/migrations/run", body: [:])
    }
}

// MARK: - Fase 22: 5 siste super-admin-views (alle endepunkter eksisterer)

extension APIClient {

    // -- Errors / Observability ------------------------------------

    func fetchAdminErrors(level: String? = nil, limit: Int = 50) async throws -> AdminErrorsResponse {
        var qs = "?limit=\(limit)"
        if let level { qs += "&level=\(level)" }
        return try await get("/api/admin-room/errors\(qs)")
    }

    func fetchAdminErrorsStats() async throws -> AdminErrorsStatsResponse {
        try await get("/api/admin-room/errors/stats")
    }

    func resolveAdminError(id: String) async throws {
        try await post("/api/admin-room/errors/\(id)/resolve", body: [:])
    }

    func reopenAdminError(id: String) async throws {
        try await post("/api/admin-room/errors/\(id)/reopen", body: [:])
    }

    // -- Market Intelligence ---------------------------------------

    func fetchMarketScans() async throws -> MarketScansResponse {
        try await get("/api/market-scans")
    }

    func fetchMarketScanCompetitors(scanId: String) async throws -> MarketScanCompetitorsResponse {
        try await get("/api/market-scans/\(scanId)/competitors")
    }

    func fetchMarketScanOpportunities(scanId: String) async throws -> MarketScanOpportunitiesResponse {
        try await get("/api/market-scans/\(scanId)/opportunities")
    }

    // -- Brand Kit (per prosjekt) ----------------------------------

    func fetchBrandKit(projectId: String) async throws -> BrandKitResponse {
        try await get("/api/role-room/brand-kit/\(projectId)")
    }

    func scanBrandKit(projectId: String) async throws -> BrandKitResponse {
        try await post("/api/role-room/brand-kit/\(projectId)/scan", body: [:])
    }

    // -- Lead Map Campaigns ----------------------------------------

    func fetchLeadMapCampaigns() async throws -> LeadMapCampaignsResponse {
        try await get("/api/lead-map/campaigns")
    }

    func fetchCategoryConversion() async throws -> CategoryConversionResponse {
        try await get("/api/lead-map/analytics/category-conversion")
    }

    // -- Org switcher (impersonation) ------------------------------

    func fetchSuperAdminOrgs() async throws -> SuperAdminOrgsResponse {
        try await get("/api/superadmin/organizations")
    }

    func fetchActiveImpersonation() async throws -> ImpersonationStatus {
        try await get("/api/superadmin/active-impersonation")
    }

    func endImpersonation() async throws {
        try await post("/api/superadmin/end-impersonation", body: [:])
    }
}

// MARK: - Fase 23: Drips + Marketplace + Partner/Developer-application + cron-triggers

extension APIClient {

    // -- Drips (e-post-serier) — super-admin manuell-trigger -------

    /// Trigge drip-cron manuelt (kjør alle pending steps NÅ).
    func runDripsCron() async throws -> DripRunResult {
        try await post("/api/leadgrid/drips/run", body: [:])
    }

    /// Marker en lead som konvertert i drip-systemet (stopper serien).
    func markDripConverted(leadId: String, conversionType: String) async throws {
        try await post("/api/leadgrid/drips/converted",
                        body: ["lead_id": leadId, "conversion_type": conversionType])
    }

    // -- Scheduled reports manuell-cron-trigger --------------------

    /// Kjør alle pending scheduled-reports NÅ (super-admin override).
    func runScheduledReportsCron() async throws {
        try await post("/api/leadgrid/scheduled-reports/run", body: [:])
    }

    // -- Marketplace -----------------------------------------------

    /// Liste public marketplace-partnere m/ filter på type + tier.
    func fetchLeadgridMarketplace(type: String? = nil, tier: String? = nil) async throws -> LeadgridMarketplaceResponse {
        var qs: [String] = []
        if let type { qs.append("type=\(type)") }
        if let tier { qs.append("tier=\(tier)") }
        let q = qs.isEmpty ? "" : "?" + qs.joined(separator: "&")
        return try await get("/api/leadgrid/marketplace\(q)")
    }

    // -- Partner-application (selv-tjeneste) ------------------------

    /// Hent min organisasjons partner-søknad (hvis innsendt).
    func fetchMyPartnerApplication() async throws -> LeadgridMyPartnerApplicationResponse {
        try await get("/api/leadgrid/partner-application/my")
    }

    /// Send inn partner-søknad for en organisasjon.
    func submitPartnerApplication(
        organizationId: String, partnerType: String,
        proposedTagline: String?, reason: String?,
        proposedLogoUrl: String?, termsVersion: String, agreedToTerms: Bool,
    ) async throws {
        var body: [String: Any] = [
            "organizationId": organizationId,
            "partnerType": partnerType,
            "termsVersion": termsVersion,
            "agreedToTerms": agreedToTerms,
        ]
        if let proposedTagline { body["proposedTagline"] = proposedTagline }
        if let reason { body["reason"] = reason }
        if let proposedLogoUrl { body["proposedLogoUrl"] = proposedLogoUrl }
        try await post("/api/leadgrid/partner-applications", body: body)
    }

    /// Hent gjeldende partner-terms (versjon + tekst).
    func fetchLeadgridPartnerTerms() async throws -> LeadgridPartnerTerms {
        try await get("/api/leadgrid/partner-terms")
    }

    // -- Developer-application -------------------------------------

    /// Send inn developer-søknad (utvikler-program for Leadgrid API).
    func submitDeveloperApplication(payload: LeadgridDeveloperApplication, agreedToTerms: Bool) async throws {
        var body: [String: Any] = [
            "email": payload.email,
            "agreedToTerms": agreedToTerms,
        ]
        if let n = payload.fullName { body["fullName"] = n }
        if let o = payload.organizationName { body["organizationName"] = o }
        if let w = payload.website { body["website"] = w }
        if let u = payload.useCase { body["useCase"] = u }
        if let d = payload.integrationDescription { body["integrationDescription"] = d }
        if let c = payload.expectedMonthlyApiCalls { body["expectedMonthlyApiCalls"] = c }
        try await post("/api/leadgrid/developer-application", body: body)
    }
}

// MARK: - Fase 24: Newsletter + RR-økonomi + Outreach

extension APIClient {

    // -- Newsletter (RR-Newsletter CMS) ----------------------------

    func fetchNewsletterIssues() async throws -> NewsletterIssuesResponse {
        try await get("/api/admin-room/newsletter/role-room/issues")
    }

    func fetchNewsletterStats() async throws -> NewsletterStatsResponse {
        try await get("/api/admin-room/newsletter/role-room/stats")
    }

    func fetchNewsletterSignups(limit: Int = 50) async throws -> NewsletterSignupsResponse {
        try await get("/api/admin-room/newsletter/role-room/signups?limit=\(limit)")
    }

    func sendNewsletterTest(issueId: String, recipient: String) async throws {
        try await post(
            "/api/admin-room/newsletter/role-room/issues/\(issueId)/send-test",
            body: ["recipient": recipient],
        )
    }

    func sendNewsletter(issueId: String) async throws {
        try await post(
            "/api/admin-room/newsletter/role-room/issues/\(issueId)/send", body: [:])
    }

    func unpublishNewsletter(issueId: String) async throws {
        try await post(
            "/api/admin-room/newsletter/role-room/issues/\(issueId)/unpublish", body: [:])
    }

    // -- RR-Økonomi ------------------------------------------------

    func fetchRoleRoomEconomyAggregate() async throws -> RoleRoomEconomyAggregate {
        try await get("/api/admin-room/role-room/economy/aggregate")
    }

    func fetchRoleRoomEconomySubscribers(status: String? = nil) async throws -> RoleRoomEconomySubscribersResponse {
        let qs = status.map { "?status=\($0)" } ?? ""
        return try await get("/api/admin-room/role-room/economy/subscribers\(qs)")
    }

    func fetchRoleRoomEconomyTimeseries(months: Int = 12) async throws -> RoleRoomEconomyTimeseriesResponse {
        try await get("/api/admin-room/role-room/economy/timeseries?months=\(months)")
    }

    func cancelRoleRoomSubscription(subscriptionId: String) async throws {
        try await post(
            "/api/admin-room/role-room/subscription/\(subscriptionId)/cancel", body: [:])
    }

    // -- Outreach-templates ----------------------------------------

    func fetchOutreachTemplates(segment: String? = nil, language: String? = nil) async throws -> OutreachTemplatesResponse {
        var qs: [String] = []
        if let segment { qs.append("segment=\(segment)") }
        if let language { qs.append("language=\(language)") }
        let q = qs.isEmpty ? "" : "?" + qs.joined(separator: "&")
        return try await get("/api/admin-room/outreach-templates\(q)")
    }

    func personalizeOutreachTemplate(templateId: String, leadId: String) async throws -> [String: String] {
        try await post(
            "/api/admin-room/outreach-templates/personalize",
            body: ["template_id": templateId, "lead_id": leadId],
        )
    }
}

// MARK: - Fase 25: Ad-tech-stack (Google/Meta/LinkedIn/TikTok + GTM/GA4/GSC)

extension APIClient {

    // -- Configs CRUD ---------------------------------------------

    func fetchAdsConfigs() async throws -> AdsConfigsResponse {
        try await get("/api/admin-room/agent/ads/configs")
    }

    func fetchAdsConfig(id: String) async throws -> AdsConfigDetailResponse {
        try await get("/api/admin-room/agent/ads/configs/\(id)")
    }

    // -- Approval-flyt --------------------------------------------

    /// Producer ber klient godkjenne Agent-anbefalinger.
    func requestAdsConfigApproval(id: String) async throws {
        try await post("/api/admin-room/agent/ads/configs/\(id)/request-approval", body: [:])
    }

    /// Liste pending approvals klient skal godkjenne.
    func fetchPendingAdsApprovals() async throws -> AdsApprovalsResponse {
        try await get("/api/role-room/ads-approvals/pending")
    }

    /// Klient godkjenner ads-config.
    func approveAdsConfig(configId: String) async throws {
        try await post("/api/role-room/ads-approvals/\(configId)/approve", body: [:])
    }

    /// Klient avslår ads-config.
    func rejectAdsConfig(configId: String, reason: String?) async throws {
        var body: [String: Any] = [:]
        if let reason { body["reason"] = reason }
        try await post("/api/role-room/ads-approvals/\(configId)/reject", body: body)
    }

    // -- Setup diagnose + insights --------------------------------

    func diagnoseAdsConfigSetup(id: String) async throws -> AdsSetupDiagnoseResponse {
        try await get("/api/admin-room/agent/ads/configs/\(id)/setup/diagnose")
    }

    func fetchAdsConfigInsights(id: String) async throws -> AdsInsightsResponse {
        try await get("/api/admin-room/agent/ads/configs/\(id)/insights")
    }

    // -- Google Search Console ------------------------------------

    func verifyGsc(id: String) async throws {
        try await post("/api/admin-room/agent/ads/configs/\(id)/gsc/verify", body: [:])
    }

    func submitGscSitemap(id: String) async throws {
        try await post("/api/admin-room/agent/ads/configs/\(id)/gsc/sitemap", body: [:])
    }

    func diagnoseGsc(id: String) async throws -> AdsSetupDiagnoseResponse {
        try await get("/api/admin-room/agent/ads/configs/\(id)/gsc/diagnose")
    }

    // -- GA4 + GTM provisjon --------------------------------------

    func provisionGa4(id: String) async throws {
        try await post("/api/admin-room/agent/ads/configs/\(id)/ga4/provision", body: [:])
    }

    func provisionGtm(id: String) async throws {
        try await post("/api/admin-room/agent/ads/configs/\(id)/gtm/provision", body: [:])
    }

    func importGtmTags(id: String) async throws {
        try await post("/api/admin-room/agent/ads/configs/\(id)/gtm/import-tags", body: [:])
    }

    // -- Meta-platform actions ------------------------------------

    func provisionMetaPixel(id: String) async throws {
        try await post("/api/admin-room/agent/ads/configs/\(id)/meta/provision-pixel", body: [:])
    }

    func syncMetaConversions(id: String) async throws {
        try await post("/api/admin-room/agent/ads/configs/\(id)/meta/sync-conversions", body: [:])
    }

    func createMetaAudience(id: String, name: String) async throws {
        try await post(
            "/api/admin-room/agent/ads/configs/\(id)/meta/create-audience",
            body: ["name": name],
        )
    }

    // -- Google Ads actions ---------------------------------------

    func syncAdsConfigToGoogle(id: String) async throws {
        try await post("/api/admin-room/agent/ads/configs/\(id)/sync-to-google", body: [:])
    }

    func createGoogleAdsAudience(id: String, name: String) async throws {
        try await post(
            "/api/admin-room/agent/ads/configs/\(id)/google/create-audience",
            body: ["name": name],
        )
    }

    // -- LinkedIn actions -----------------------------------------

    func provisionLinkedInInsightTag(id: String) async throws {
        try await post(
            "/api/admin-room/agent/ads/configs/\(id)/linkedin/provision-insight-tag", body: [:])
    }

    func syncLinkedInConversions(id: String) async throws {
        try await post(
            "/api/admin-room/agent/ads/configs/\(id)/linkedin/sync-conversions", body: [:])
    }

    func createLinkedInAudience(id: String, name: String) async throws {
        try await post(
            "/api/admin-room/agent/ads/configs/\(id)/linkedin/create-audience",
            body: ["name": name],
        )
    }

    // -- TikTok actions -------------------------------------------

    func provisionTiktokPixel(id: String) async throws {
        try await post("/api/admin-room/agent/ads/configs/\(id)/tiktok/provision-pixel", body: [:])
    }

    func syncTiktokEvents(id: String) async throws {
        try await post("/api/admin-room/agent/ads/configs/\(id)/tiktok/sync-events", body: [:])
    }

    func syncTiktokLeads(id: String) async throws {
        try await post("/api/admin-room/agent/ads/configs/\(id)/tiktok/sync-leads", body: [:])
    }

    func createTiktokAudience(id: String, name: String) async throws {
        try await post(
            "/api/admin-room/agent/ads/configs/\(id)/tiktok/create-audience",
            body: ["name": name],
        )
    }

    // -- Account-lookups (OAuth-account-listing per platform) -----

    func fetchGa4Accounts() async throws -> OAuthAccountsResponse {
        try await get("/api/admin-room/agent/ads/ga4/accounts")
    }

    func fetchMetaAccounts() async throws -> OAuthAccountsResponse {
        try await get("/api/admin-room/agent/ads/meta/accounts")
    }

    func fetchLinkedInAccounts() async throws -> OAuthAccountsResponse {
        try await get("/api/admin-room/agent/ads/linkedin/accounts")
    }
}

// MARK: - Fase 26: Cockpit-sub + Lead-map-detalj + Decks/funding + Error-detail

extension APIClient {

    // -- Cockpit: PR / Journalists --------------------------------

    func fetchPRJournalists() async throws -> PRJournalistsResponse {
        try await get("/api/admin-room/cockpit/pr/journalists")
    }

    func fetchPRReleases() async throws -> PRReleasesResponse {
        try await get("/api/admin-room/cockpit/pr/releases")
    }

    func generatePRRelease(prompt: String) async throws -> PRRelease {
        try await post(
            "/api/admin-room/cockpit/pr/releases/generate",
            body: ["prompt": prompt],
        )
    }

    func distributePRRelease(id: String) async throws {
        try await post("/api/admin-room/cockpit/pr/releases/\(id)/distribute", body: [:])
    }

    // -- Cockpit: Webinars ----------------------------------------

    func fetchCockpitWebinars() async throws -> CockpitWebinarsResponse {
        try await get("/api/admin-room/cockpit/webinars")
    }

    // -- Cockpit: Referrals + nurture-cron ------------------------

    func fetchCockpitReferrals() async throws -> CockpitReferralsResponse {
        try await get("/api/admin-room/cockpit/referrals")
    }

    func runNurtureCron() async throws -> NurtureRunResult {
        try await post("/api/admin-room/cockpit/nurture/run-due", body: [:])
    }

    // -- Lead Map detalj-sub --------------------------------------

    /// Søk steder via Google Places API.
    func searchLeadMapPlaces(query: String) async throws -> LeadMapPlacesSearchResponse {
        let encoded = query.addingPercentEncoding(withAllowedCharacters: .urlQueryAllowed) ?? query
        return try await get("/api/admin-room/lead-map/places/search?q=\(encoded)")
    }

    /// Importer søkeresultater som leads.
    func importLeadMapPlaces(placeIds: [String]) async throws -> LeadMapPlaceImportResult {
        try await post(
            "/api/admin-room/lead-map/places/import",
            body: ["place_ids": placeIds],
        )
    }

    /// Generer Claude AI-pitch for en gitt lead.
    func generateLeadPitch(leadId: String) async throws -> LeadMapPitch {
        try await post(
            "/api/admin-room/lead-map/leads/\(leadId)/generate-pitch", body: [:])
    }

    /// Hent geo-data for en lead (lat/lng/distance fra meg).
    func fetchLeadGeo(leadId: String) async throws -> [String: AnyCodableShim] {
        try await get("/api/admin-room/lead-map/leads/\(leadId)/geo")
    }

    // -- Admin Decks (business decks) -----------------------------

    func fetchAdminDecks() async throws -> AdminDecksResponse {
        try await get("/api/admin-room/decks")
    }

    func fetchAdminDeckSlides(deckId: String) async throws -> AdminDeckSlidesResponse {
        try await get("/api/admin-room/decks/\(deckId)/slides")
    }

    func generateDeckSlide(deckId: String, slideId: String, prompt: String) async throws {
        try await post(
            "/api/admin-room/decks/\(deckId)/slides/\(slideId)/generate",
            body: ["prompt": prompt],
        )
    }

    // -- Funding Apps ---------------------------------------------

    func fetchFundingApps() async throws -> FundingAppsResponse {
        try await get("/api/admin-room/funding-apps")
    }

    func generateFundingApp(id: String, prompt: String) async throws {
        try await post(
            "/api/admin-room/funding-apps/\(id)/generate",
            body: ["prompt": prompt],
        )
    }

    // -- CS Snapshot-all -------------------------------------------

    /// Lag snapshot av alle kunder NÅ (cron-trigger fra iPad).
    func runCSSnapshotAll() async throws -> CSSnapshotAllResult {
        try await post("/api/admin-room/customer-success/snapshot-all", body: [:])
    }

    // -- Error detail ---------------------------------------------

    func fetchAdminErrorDetail(id: String) async throws -> AdminErrorDetailResponse {
        try await get("/api/admin-room/errors/\(id)")
    }

    // -- Leadgrid Research (Claude + BRREG + website-analyse) ------
    //
    // Native iPad-view for "Research med AI" per kunde. Backend ligger
    // i backend/server/leadgrid-research-routes.ts.

    /// Hent cached research hvis < 30 dager gammel. Returner nil ved 404
    /// (ingen research kjørt enda, eller stale).
    func fetchLeadgridResearch(leadId: String) async throws -> LeadgridResearch? {
        do {
            let env: LeadgridResearchEnvelope = try await get(
                "/api/leadgrid/leads/\(leadId)/research"
            )
            return env.research
        } catch APIError.statusCode(404) {
            return nil
        }
    }

    /// Kjør hele research-pipeline nå — BRREG → website → Claude. Tar
    /// 10-30 sek. Returnerer ny research-blob.
    func runLeadgridResearch(leadId: String) async throws -> LeadgridResearch {
        let env: LeadgridResearchEnvelope = try await post(
            "/api/leadgrid/leads/\(leadId)/research"
        )
        return env.research
    }
}

/// Liten shim for å dekode arbitrary JSON-verdier (string/number/bool/null).
struct AnyCodableShim: Codable, Hashable {
    let value: String

    init(from decoder: Decoder) throws {
        let c = try decoder.singleValueContainer()
        if let s = try? c.decode(String.self) { value = s }
        else if let n = try? c.decode(Double.self) { value = "\(n)" }
        else if let b = try? c.decode(Bool.self) { value = "\(b)" }
        else { value = "" }
    }

    func encode(to encoder: Encoder) throws {
        var c = encoder.singleValueContainer()
        try c.encode(value)
    }
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

// MARK: - Leadgrid Intelligence (PR #855)

extension APIClient {

    func fetchLeadIntelligence(leadId: String) async throws -> LeadgridIntelligenceForLead {
        try await get("/api/leadgrid/intelligence/leads/\(leadId)")
    }

    func recomputeLeadIntelligence(leadId: String) async throws -> LeadgridIntelligenceForLead {
        try await post("/api/leadgrid/intelligence/leads/\(leadId)/recompute", body: nil)
    }

    func fetchNBARecommendations(priority: String? = nil, limit: Int = 50) async throws -> [LeadgridNBARecommendation] {
        var path = "/api/leadgrid/intelligence/recommendations?limit=\(limit)"
        if let p = priority { path += "&priority=\(p)" }
        let resp: NBARecommendationsResponse = try await get(path)
        return resp.recommendations
    }

    func acceptRecommendation(_ id: String) async throws -> LeadgridNBARecommendation {
        try await post("/api/leadgrid/intelligence/recommendations/\(id)/accept", body: nil)
    }

    func executeRecommendation(_ id: String, outcome: String, notes: String?) async throws -> LeadgridNBARecommendation {
        var body: [String: Any] = ["outcome": outcome]
        if let n = notes { body["outcome_notes"] = n }
        return try await post("/api/leadgrid/intelligence/recommendations/\(id)/execute", body: body)
    }

    func dismissRecommendation(_ id: String) async throws -> LeadgridNBARecommendation {
        try await post("/api/leadgrid/intelligence/recommendations/\(id)/dismiss", body: nil)
    }

    func fetchFollowUpQueue() async throws -> [LeadgridFollowUpItem] {
        let resp: FollowUpQueueResponse = try await get("/api/leadgrid/intelligence/follow-up-queue")
        return resp.items
    }

    func fetchLeadScoreHistory(leadId: String) async throws -> [LeadgridScoreHistoryEntry] {
        let resp: ScoreHistoryResponse = try await get("/api/leadgrid/intelligence/leads/\(leadId)/history")
        return resp.history
    }
}

private struct NBARecommendationsResponse: Decodable { let recommendations: [LeadgridNBARecommendation] }
private struct FollowUpQueueResponse: Decodable { let items: [LeadgridFollowUpItem] }
private struct ScoreHistoryResponse: Decodable { let history: [LeadgridScoreHistoryEntry] }
