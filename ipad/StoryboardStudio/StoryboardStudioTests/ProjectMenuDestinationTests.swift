import XCTest
@testable import StoryboardStudio

final class ProjectMenuDestinationTests: XCTestCase {
    func testProjectWithoutManuscriptOpensProductionBrowser() {
        XCTAssertEqual(
            ProjectMenuDestination.resolve(manuscriptCount: 0),
            .productionBrowser
        )
    }

    func testProjectWithOneManuscriptOpensDirectly() {
        XCTAssertEqual(
            ProjectMenuDestination.resolve(manuscriptCount: 1),
            .manuscript
        )
    }

    func testProjectWithSeveralManuscriptsUsesPicker() {
        XCTAssertEqual(
            ProjectMenuDestination.resolve(manuscriptCount: 2),
            .manuscriptPicker
        )
    }

    func testScenarioCatalogPreservesVersionedPackHierarchy() {
        let packs = RoleRoomAPIClient.summarizeScenarioPacks([[
            "id": "medical.healthcare",
            "version": "1.0.0",
            "label": "Medical & Healthcare",
            "domain": "medical",
            "description": "Production-aware care vocabulary",
            "subdomains": [[
                "id": "emergency-department",
                "label": "Emergency Department",
                "zones": [["id": "emergency-bay", "label": "Emergency Bay"]],
                "roles": [["id": "paramedic", "label": "Paramedic"]],
                "propTypes": [["id": "stretcher", "label": "Stretcher"]],
                "actions": [["id": "patient-transfer", "label": "Patient Transfer"]],
                "states": [["id": "urgent", "label": "Urgent"]],
                "continuityLocks": [["id": "patient-side", "label": "Patient Side"]],
            ]],
            "families": [[
                "id": "care-surface", "label": "Care Surfaces",
                "primaryStyleAnchor": "object-architecture",
                "variants": [["id": "hospital-bed", "label": "Hospital Bed"]],
            ]],
        ]])

        XCTAssertEqual(packs.count, 1)
        XCTAssertEqual(packs.first?.version, "1.0.0")
        XCTAssertEqual(packs.first?.subdomains.first?.id, "emergency-department")
        XCTAssertEqual(packs.first?.subdomains.first?.zones.first?.id, "emergency-bay")
        XCTAssertEqual(packs.first?.subdomains.first?.roles.first?.id, "paramedic")
        XCTAssertEqual(packs.first?.families.first?.primaryStyleAnchor, "object-architecture")
    }

    func testScenarioCatalogDropsIncompletePack() {
        let packs = RoleRoomAPIClient.summarizeScenarioPacks([[
            "id": "restaurant.food-service",
            "label": "Restaurant",
            "subdomains": [],
        ]])

        XCTAssertTrue(packs.isEmpty)
    }

    func testScenarioStampRecommendationsKeepMedicalAndRestaurantDistinct() {
        XCTAssertEqual(
            ProductionMarkCatalog.recommendedStamps(
                packId: "medical.healthcare", subdomainId: "ambulance").first,
            .carStamp)
        XCTAssertEqual(
            ProductionMarkCatalog.recommendedStamps(
                packId: "restaurant.food-service", subdomainId: "food-truck").first,
            .carStamp)
    }
}
