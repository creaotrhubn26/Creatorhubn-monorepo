import XCTest
@testable import LeadMapApp

final class DiscoveryMarketingIntelligenceTests: XCTestCase {
    func testReportDecodesEvidenceAndReviewContract() throws {
        let json = #"""
        {
          "id": "11111111-1111-4111-8111-111111111111",
          "run_id": "22222222-2222-4222-8222-222222222222",
          "skill_key": "marketing.discovery_intelligence",
          "skill_version": "1.0.0",
          "status": "ready",
          "executive_summary": "Fire dokumenterte kandidater er analysert.",
          "evidence_coverage": 0.75,
          "overall_confidence": 0.8,
          "source_count": 2,
          "evidence_catalog": [{
            "id": "E001",
            "kind": "aggregate",
            "candidate_id": null,
            "candidate_name": null,
            "label": "Antall analyserte kandidater",
            "value": "4",
            "source": "leadgrid.discovery.aggregate",
            "source_uri": null,
            "source_ref": "discovery.candidate_count"
          }],
          "conflicts": [],
          "gaps": ["Én kandidat mangler ansattdata."],
          "provider": "leadgrid",
          "model": "deterministic-evidence-v1",
          "error_code": null,
          "error_message": null,
          "insights": [{
            "id": "33333333-3333-4333-8333-333333333333",
            "category": "audience",
            "claim_type": "fact",
            "title": "Analysert målgruppegrunnlag",
            "finding": "Rapporten bygger på fire kandidater.",
            "relevance": "Dette avgrenser konklusjonene.",
            "confidence": 0.9,
            "evidence_coverage": 0.75,
            "evidence_refs": ["E001"],
            "counter_evidence": [],
            "recommended_action": "Bruk funnet kun på dette segmentet.",
            "experiment": null,
            "review_status": "accepted",
            "reviewed_at": "2026-09-05T10:00:00.000Z"
          }],
          "created_at": "2026-09-05T09:00:00.000Z",
          "updated_at": "2026-09-05T10:00:00.000Z"
        }
        """#

        let report = try JSONDecoder().decode(
            DiscoveryMarketingReport.self,
            from: Data(json.utf8))

        XCTAssertEqual(report.skillKey, "marketing.discovery_intelligence")
        XCTAssertEqual(report.status, .ready)
        XCTAssertEqual(report.evidenceCatalog.first?.id, "E001")
        XCTAssertEqual(report.insights.first?.claimType, "fact")
        XCTAssertEqual(report.insights.first?.reviewStatus, "accepted")
    }

    func testFeedbackEncodesCorrectionUsingBackendKeys() throws {
        let request = DiscoveryMarketingFeedbackRequest(
            decision: "correct",
            reasonCode: "marketer_correction",
            note: "Mer presist",
            correction: .init(
                title: "Ny tittel",
                finding: "Et mer presist og dokumentert funn.",
                relevance: "Dette avgrenser segmentet bedre.",
                recommendedAction: "Test det reviderte segmentet først."))

        let data = try JSONEncoder().encode(request)
        let object = try XCTUnwrap(
            JSONSerialization.jsonObject(with: data) as? [String: Any])
        XCTAssertEqual(object["reason_code"] as? String, "marketer_correction")
        let correction = try XCTUnwrap(object["correction"] as? [String: Any])
        XCTAssertEqual(
            correction["recommended_action"] as? String,
            "Test det reviderte segmentet først.")
    }
}
