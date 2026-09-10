import XCTest
@testable import LeadMapApp

final class WorkspacePlanPresentationTests: XCTestCase {
    @MainActor
    func testOnlyOrganizationAdminCanManageWorkspaceBilling() {
        let appState = AppState()

        appState.roleInOrg = "admin"
        appState.userRole = nil
        XCTAssertTrue(appState.canManageWorkspaceBilling)

        appState.roleInOrg = "salgssjef"
        appState.userRole = "super_admin"
        XCTAssertFalse(
            appState.canManageWorkspaceBilling,
            "Super Admin must use the separate audited provisioning flow"
        )

        appState.roleInOrg = "member"
        appState.userRole = nil
        XCTAssertFalse(appState.canManageWorkspaceBilling)
    }

    func testBillingAndOrganizationStorageSummaryDecodes() throws {
        let data = Data(#"""
        {
          "plan_key":"solo_pro",
          "display_name":"Solo Pro",
          "in_grace":false,
          "grace_expires_at":null,
          "limits":{
            "display_name":"Solo Pro",
            "max_active_customers":10,
            "max_auto_onboards_per_month":30,
            "max_team_members":5,
            "included_storage_bytes":53687091200
          },
          "usage":{"customers_active":2,"auto_onboards_this_month":1},
          "pct":{"customers":20,"auto_onboards":3},
          "billing":{
            "subscription_status":"past_due",
            "past_due_since":"2026-09-01T00:00:00.000Z",
            "read_only_at":"2026-09-08T00:00:00.000Z"
          },
          "storage":{
            "included_bytes":53687091200,
            "addon_quantity":1,
            "capacity_bytes":161061273600,
            "used_bytes":1073741824,
            "reserved_bytes":0,
            "available_bytes":159987531776
          }
        }
        """#.utf8)
        let decoder = JSONDecoder()
        decoder.keyDecodingStrategy = .convertFromSnakeCase
        let summary = try decoder.decode(LeadgridPlanSummary.self, from: data)
        XCTAssertTrue(summary.isBillingReadOnly)
        XCTAssertEqual(summary.limits.maxActiveCustomers, 10)
        XCTAssertEqual(summary.storage?.addonQuantity, 1)
        XCTAssertEqual(summary.storage?.capacityBytes, 161_061_273_600)
    }

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
