import XCTest
@testable import LeadMapApp

final class WorkspacePlanPresentationTests: XCTestCase {
    func testCanonicalLeadgridPlanNames() {
        XCTAssertEqual(LeadgridPlanPresentation.displayName(for: "solo_free"), "Solo (gratis)")
        XCTAssertEqual(LeadgridPlanPresentation.displayName(for: "solo_pro"), "Solo Pro")
        XCTAssertEqual(LeadgridPlanPresentation.displayName(for: "agency"), "Agency")
        XCTAssertEqual(LeadgridPlanPresentation.displayName(for: "enterprise"), "Enterprise")
    }

    func testLegacyAndUnknownPlanNamesRemainReadable() {
        XCTAssertEqual(LeadgridPlanPresentation.displayName(for: "free"), "Solo (gratis)")
        XCTAssertEqual(LeadgridPlanPresentation.displayName(for: "pro_agency"), "Agency")
        XCTAssertEqual(LeadgridPlanPresentation.displayName(for: "partner_custom"), "Partner Custom")
        XCTAssertEqual(LeadgridPlanPresentation.displayName(for: nil), "Ingen aktiv plan")
    }

    func testPlanIconsFollowWorkspaceType() {
        XCTAssertEqual(LeadgridPlanPresentation.icon(for: "solo_pro"), "person.crop.circle.fill")
        XCTAssertEqual(LeadgridPlanPresentation.icon(for: "agency"), "building.2.fill")
        XCTAssertEqual(LeadgridPlanPresentation.icon(for: "solo_free"), "leaf.fill")
    }

    func testSellerRolesDefaultToAssignedLeads() {
        XCTAssertEqual(
            LeadsWorkspaceScope.defaultScope(for: "salgskonsulent"),
            .assignedToMe
        )
        XCTAssertEqual(
            LeadsWorkspaceScope.defaultScope(for: "promotor"),
            .assignedToMe
        )
    }

    func testManagersKeepAllLeadsAsDefault() {
        XCTAssertEqual(LeadsWorkspaceScope.defaultScope(for: "admin"), .all)
        XCTAssertEqual(LeadsWorkspaceScope.defaultScope(for: "salgssjef"), .all)
        XCTAssertEqual(LeadsWorkspaceScope.defaultScope(for: "teamleder"), .all)
        XCTAssertEqual(LeadsWorkspaceScope.defaultScope(for: nil), .all)
    }

    @MainActor
    func testWorkspaceSwitchClearsPreviousEntitlements() {
        let store = EntitlementStore.shared
        defer {
            store.resetForOrganization(nil)
            store.applyPlan(.enterprise)
        }

        store.resetForOrganization("workspace-a")
        store.applyServer(OrgEntitlementsEnvelope(
            organizationId: "workspace-a",
            plan: "solo_pro",
            entitlements: [
                OrgEntitlementRowDTO(
                    featureKey: "leads",
                    state: "locked",
                    monthlyLimit: nil,
                    trialEndsAt: nil,
                    addonPriceMonthly: nil
                ),
            ],
            leadgridDiscoveryEnabled: false
        ))

        XCTAssertTrue(store.hasServerEntitlements)
        XCTAssertNotNil(store.entitlements[.leads])

        store.resetForOrganization("workspace-b")

        XCTAssertEqual(store.serverOrganizationId, "workspace-b")
        XCTAssertFalse(store.hasServerEntitlements)
        XCTAssertTrue(store.entitlements.isEmpty)
        XCTAssertEqual(store.currentPlanDisplayName, "Laster …")
    }
}
