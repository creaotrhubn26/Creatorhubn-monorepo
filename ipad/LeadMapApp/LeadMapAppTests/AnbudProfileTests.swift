import XCTest
@testable import LeadMapApp

final class AnbudProfileTests: XCTestCase {
    @MainActor
    func testDiscoveryAnbudIntentIsProjectScopedAndOneShot() {
        let state = AppState()

        state.requestAnbudSearch(
            projectId: "tidum-project",
            cpvCodes: [
                "48450000", "72212450", "48332000", "48311000",
                "48311100", "extra-one", "extra-two",
            ],
            query: " turnus "
        )

        XCTAssertEqual(state.selectedSidebarItem, .anbud)
        XCTAssertEqual(state.pendingAnbudSearch?.projectId, "tidum-project")
        XCTAssertEqual(state.pendingAnbudSearch?.cpvCodes.count, 6)
        XCTAssertEqual(state.pendingAnbudSearch?.query, "turnus")

        let wrongID = UUID()
        state.clearAnbudSearchIntent(id: wrongID)
        XCTAssertNotNil(state.pendingAnbudSearch)

        let intentID = try! XCTUnwrap(state.pendingAnbudSearch?.id)
        state.clearAnbudSearchIntent(id: intentID)
        XCTAssertNil(state.pendingAnbudSearch)
    }

    func testProjectProfileDecodesManagedWatchContract() throws {
        let data = Data(#"""
        {
          "id":"22222222-2222-4222-8222-222222222222",
          "template_key":"tidum.procurement",
          "template_version":1,
          "name":"Tidum – arbeidstid, turnus og dokumentasjon",
          "description":"Produktprofil",
          "status":"draft",
          "cpv_codes":["48450000","72212450"],
          "keywords":["arbeidstid"],
          "exclusion_terms":["kjøp av omsorgsplasser"],
          "suggested_watches":[{
            "key":"tidum.time_hr_software",
            "name":"Tidum · Arbeidstid og HR-programvare",
            "query":{"q":null,"location":null,"cpv":"48450000,72212450"}
          }],
          "selected_watch_keys":[],
          "requires_admin_confirmation":true,
          "confirmed_at":null,
          "can_manage":true
        }
        """#.utf8)

        let profile = try JSONDecoder().decode(DoffinProjectProfileDTO.self, from: data)
        XCTAssertEqual(profile.templateKey, "tidum.procurement")
        XCTAssertFalse(profile.isActive)
        XCTAssertTrue(profile.canManage)
        XCTAssertEqual(profile.suggestedWatches.first?.query.cpv, "48450000,72212450")
    }
}
