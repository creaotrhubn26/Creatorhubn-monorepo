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
