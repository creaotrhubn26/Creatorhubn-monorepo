import XCTest
@testable import LeadMapApp

final class LeadgridAgentSkillTests: XCTestCase {
    private let leadID = "lead-1"
    private let now = Date(timeIntervalSince1970: 1_800_000_000)

    private func tool(
        id: String = "tool-1",
        name: String,
        input: String
    ) -> AgentToolUse {
        AgentToolUse(id: id, name: name, inputJSON: input)
    }

    func testAllSixSkillContractsValidate() throws {
        let future = ISO8601DateFormatter().string(from: now.addingTimeInterval(3_600))
        let allowed = Set([leadID])
        let tools = [
            tool(name: "leadgrid_find_duplicates", input: #"{"lead_id":"lead-1"}"#),
            tool(name: "leadgrid_enrich_company", input: #"{"lead_id":"lead-1","force_refresh":true}"#),
            tool(
                name: "leadgrid_log_visit",
                input: """
                {"lead_id":"lead-1","visit_type":"phone","conversation_summary":"God samtale","next_follow_up_at":"\(future)"}
                """
            ),
            tool(name: "leadgrid_sync_offline_actions", input: #"{"reason":"Brukeren ba om synk"}"#),
            tool(
                name: "leadgrid_plan_follow_up",
                input: """
                {"lead_id":"lead-1","next_follow_up_at":"\(future)","next_action":"Ring igjen"}
                """
            ),
            tool(name: "leadgrid_data_quality", input: #"{"lead_id":"lead-1","limit":1}"#),
        ]

        XCTAssertEqual(Set(LeadgridAgentSkill.allCases.map(\.rawValue)), Set(tools.map(\.name)))
        for candidate in tools {
            XCTAssertNoThrow(try LeadgridAgentSkillValidator.validate(
                candidate,
                allowedLeadIDs: allowed,
                now: now
            ))
        }
    }

    func testRejectsUnknownSkillUnknownFieldAndCrossTenantLead() {
        XCTAssertThrowsError(try LeadgridAgentSkillValidator.validate(
            tool(name: "delete_everything", input: "{}"),
            allowedLeadIDs: [leadID],
            now: now
        ))
        XCTAssertThrowsError(try LeadgridAgentSkillValidator.validate(
            tool(name: "leadgrid_find_duplicates", input: #"{"lead_id":"lead-1","unsafe":true}"#),
            allowedLeadIDs: [leadID],
            now: now
        ))
        XCTAssertThrowsError(try LeadgridAgentSkillValidator.validate(
            tool(name: "leadgrid_find_duplicates", input: #"{"lead_id":"lead-from-other-org"}"#),
            allowedLeadIDs: [leadID],
            now: now
        )) { error in
            XCTAssertEqual(error as? LeadgridAgentSkillValidationError, .leadOutsideActiveContext)
        }
    }

    func testRejectsMissingToolIDPastFollowUpAndBooleanLimit() {
        XCTAssertThrowsError(try LeadgridAgentSkillValidator.validate(
            tool(id: " ", name: "leadgrid_data_quality", input: "{}"),
            allowedLeadIDs: [leadID],
            now: now
        ))
        XCTAssertThrowsError(try LeadgridAgentSkillValidator.validate(
            tool(
                name: "leadgrid_plan_follow_up",
                input: #"{"lead_id":"lead-1","next_follow_up_at":"2020-01-01T12:00:00Z","next_action":"Ring"}"#
            ),
            allowedLeadIDs: [leadID],
            now: now
        ))
        XCTAssertThrowsError(try LeadgridAgentSkillValidator.validate(
            tool(name: "leadgrid_data_quality", input: #"{"limit":true}"#),
            allowedLeadIDs: [leadID],
            now: now
        ))
    }

    func testPersistedToolProposalDecodesWithoutLosingNestedInput() throws {
        let json = """
        {
          "id":"message-1",
          "thread_id":"thread-1",
          "role":"assistant",
          "text":"Jeg foreslår en kontroll.",
          "response":{
            "toolUses":[{
              "id":"tool-1",
              "name":"leadgrid_log_visit",
              "input":{"lead_id":"lead-1","visit_type":"phone","conversation_summary":"Ringte","meta":{"source":"agent"}}
            }]
          },
          "created_at":"2026-09-03T10:00:00Z"
        }
        """
        let decoder = JSONDecoder()
        decoder.keyDecodingStrategy = .convertFromSnakeCase
        let message = try decoder.decode(AgentMessage.self, from: Data(json.utf8))
        let decodedTool = try XCTUnwrap(message.response?.toolUses?.first)
        XCTAssertEqual(decodedTool.id, "tool-1")
        XCTAssertEqual(decodedTool.name, "leadgrid_log_visit")
        let input = try XCTUnwrap(
            JSONSerialization.jsonObject(with: Data(decodedTool.inputJSON.utf8)) as? [String: Any]
        )
        XCTAssertEqual(input["lead_id"] as? String, leadID)
        XCTAssertEqual((input["meta"] as? [String: Any])?["source"] as? String, "agent")
    }

    @MainActor
    func testMutationActionIDIsStableAndTenantScoped() {
        let first = LeadgridAgentSkillExecutor.stableActionID(
            organizationId: "org-a",
            toolID: "tool-1"
        )
        XCTAssertEqual(first, LeadgridAgentSkillExecutor.stableActionID(
            organizationId: "org-a",
            toolID: "tool-1"
        ))
        XCTAssertNotEqual(first, LeadgridAgentSkillExecutor.stableActionID(
            organizationId: "org-b",
            toolID: "tool-1"
        ))
    }

    @MainActor
    func testOfflineVisitAndFollowUpActionsMatchBackendContract() throws {
        let actionID = UUID(uuidString: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa")!
        let visit = try OfflineResilientActions.makeAgentVisitAction(
            organizationId: "org-a",
            leadId: leadID,
            payload: .init(
                visitType: "phone",
                conversationSummary: "Ringte",
                contactPerson: nil,
                notes: nil,
                newStatus: "interested",
                nextAction: nil,
                nextFollowUpAt: nil
            ),
            actionId: actionID
        )
        XCTAssertEqual(visit.id, actionID)
        XCTAssertEqual(visit.organizationId, "org-a")
        XCTAssertEqual(visit.httpMethod, "POST")
        XCTAssertEqual(visit.endpoint, "/api/admin-room/lead-map/leads/lead-1/visits")
        let visitBody = try XCTUnwrap(
            JSONSerialization.jsonObject(with: try XCTUnwrap(visit.bodyJson)) as? [String: Any]
        )
        XCTAssertEqual(visitBody["visitType"] as? String, "phone")
        XCTAssertEqual(visitBody["conversationSummary"] as? String, "Ringte")
        XCTAssertNil(visitBody["visit_type"])

        let followUp = try OfflineResilientActions.makeAgentFollowUpAction(
            organizationId: "org-a",
            leadId: leadID,
            payload: .init(
                nextFollowUpAt: "2030-01-01T12:00:00Z",
                nextAction: "Ring igjen"
            ),
            actionId: actionID
        )
        XCTAssertEqual(followUp.id, actionID)
        XCTAssertEqual(followUp.httpMethod, "PATCH")
        XCTAssertEqual(followUp.endpoint, "/api/admin-room/lead-map/leads/lead-1/follow-up")
        let followUpBody = try XCTUnwrap(
            JSONSerialization.jsonObject(with: try XCTUnwrap(followUp.bodyJson)) as? [String: Any]
        )
        XCTAssertEqual(followUpBody["next_follow_up_at"] as? String, "2030-01-01T12:00:00Z")
        XCTAssertEqual(followUpBody["next_action"] as? String, "Ring igjen")
        XCTAssertNil(followUpBody["nextFollowUpAt"])
    }

    @MainActor
    func testPondusUsageActionKeepsExactSessionAndTenant() throws {
        let templateId = UUID(uuidString: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb")!
        let sessionId = UUID(uuidString: "cccccccc-cccc-4ccc-8ccc-cccccccccccc")!
        let action = try OfflineResilientActions.makePondusUsageAction(
            organizationId: "org-a",
            templateId: templateId,
            payload: .init(
                usageSessionId: sessionId,
                leadId: nil,
                outcome: "meeting_booked",
                source: "ipad"
            ),
            actionId: sessionId
        )
        XCTAssertEqual(action.id, sessionId)
        XCTAssertEqual(action.organizationId, "org-a")
        XCTAssertEqual(
            action.endpoint,
            "/api/leadgrid/pondus/templates/bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb/usage"
        )
        let body = try XCTUnwrap(
            JSONSerialization.jsonObject(with: try XCTUnwrap(action.bodyJson)) as? [String: Any]
        )
        XCTAssertEqual(body["usage_session_id"] as? String, sessionId.uuidString)
        XCTAssertEqual(body["outcome"] as? String, "meeting_booked")
        XCTAssertEqual(body["source"] as? String, "ipad")
    }

    func testPondusQuizCacheIsSeparatedByUserAndOrganization() {
        let a = PondusQuizLocalResult.storageKey(
            userEmail: "Selger@Example.no",
            organizationId: "org-a"
        )
        let normalized = PondusQuizLocalResult.storageKey(
            userEmail: "selger@example.no",
            organizationId: "org-a"
        )
        let otherUser = PondusQuizLocalResult.storageKey(
            userEmail: "annen@example.no",
            organizationId: "org-a"
        )
        let otherOrg = PondusQuizLocalResult.storageKey(
            userEmail: "selger@example.no",
            organizationId: "org-b"
        )
        XCTAssertEqual(a, normalized)
        XCTAssertNotEqual(a, otherUser)
        XCTAssertNotEqual(a, otherOrg)
        XCTAssertNil(PondusQuizLocalResult.storageKey(userEmail: nil, organizationId: "org-a"))
    }

    @MainActor
    func testPondusDeepLinkSurvivesColdStartWithExactStep() {
        let bridge = AppStateBridge.shared
        bridge.appState = nil
        bridge.navigateToPondus(
            templateId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
            templateName: "Møteåpning",
            stepIndex: 3
        )

        let state = AppState()
        bridge.register(state)
        bridge.flushPendingDeepLinks()

        XCTAssertEqual(state.selectedSidebarItem, .leadbook)
        XCTAssertEqual(state.deepLinkPondusTemplateId, "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb")
        XCTAssertEqual(state.deepLinkPondusTemplateName, "Møteåpning")
        XCTAssertEqual(state.deepLinkPondusStepIndex, 3)

        state.clearPondusDeepLink()
        XCTAssertNil(state.deepLinkPondusTemplateId)
        XCTAssertNil(state.deepLinkPondusStepIndex)
        bridge.appState = nil
    }
}
