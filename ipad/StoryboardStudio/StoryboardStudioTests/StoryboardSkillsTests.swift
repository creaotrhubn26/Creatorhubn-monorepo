import XCTest
@testable import StoryboardStudio

final class StoryboardSkillsTests: XCTestCase {
    func testAllProfessionalSkillsHaveStableUniqueIdentifiers() {
        XCTAssertEqual(StoryboardSkillID.allCases.count, 8)
        XCTAssertEqual(Set(StoryboardSkillID.allCases.map(\.rawValue)).count, 8)
        XCTAssertTrue(StoryboardSkillID.designShotVariants.requiresFrame)
        XCTAssertTrue(StoryboardSkillID.translateArtistMarks.requiresFrame)
        XCTAssertFalse(StoryboardSkillID.planSceneCoverage.requiresFrame)
        XCTAssertFalse(StoryboardSkillID.reconcileStoryboardRevision.requiresFrame)
    }

    func testSuggestionContractDecodesEvidenceAlternativesAndCost() throws {
        let payload = """
        {
          "id":"suggestion-1",
          "projectId":"project-1",
          "status":"pending",
          "agentName":"storyboard.design-shot-variants",
          "modelVersion":"local-rules-1.0.0",
          "createdAt":"2026-09-12T12:00:00Z",
          "payload":{
            "contractVersion":"storyboard-skill-result-v1",
            "skillId":"design_shot_variants",
            "skillVersion":"1.0.0",
            "title":"Tre alternativer",
            "summary":"Velg én.",
            "rationale":"Tydelige tradeoffs.",
            "confidence":0.91,
            "severity":"info",
            "contextFingerprint":"aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
            "evidence":[{"id":"e1","label":"Shot 1A","detail":"Kilde","frameIds":["frame-1"]}],
            "recommendedChanges":[],
            "alternatives":[{
              "id":"geography",
              "title":"Geografi",
              "tradeoff":"Tydelig, mindre intimt.",
              "changes":[{
                "id":"c1",
                "operation":"update-frame",
                "frameId":"frame-1",
                "label":"Bruk",
                "reason":"Vis blocking",
                "patch":{"shotType":"WS","lensMm":24,"duration":3.5}
              }]
            }],
            "warnings":[],
            "cost":{"provider":"local","estimatedUsd":0}
          }
        }
        """
        let suggestion = try JSONDecoder().decode(
            StoryboardSkillSuggestionDTO.self,
            from: try XCTUnwrap(payload.data(using: .utf8)))

        XCTAssertEqual(suggestion.payload.skillId, .designShotVariants)
        XCTAssertEqual(suggestion.payload.evidence.first?.frameIds, ["frame-1"])
        XCTAssertEqual(suggestion.payload.alternatives.first?.changes.first?.patch.lensMm, 24)
        XCTAssertEqual(suggestion.payload.cost.estimatedUsd, 0)
    }

    func testPatchMapsOnlyExplicitFieldsForExistingSyncPath() throws {
        let data = try XCTUnwrap(
            #"{"shotType":"CU","movement":"Slow Push In","lensMm":85,"duration":3,"continuityNotes":"Hold akse"}"#
                .data(using: .utf8))
        let patch = try JSONDecoder().decode(StoryboardSkillFramePatchDTO.self, from: data)
        let fields = patch.fields

        XCTAssertEqual(fields["shotType"] as? String, "CU")
        XCTAssertEqual(fields["cameraMovement"] as? String, "Slow Push In")
        XCTAssertEqual(fields["lensMm"] as? Int, 85)
        XCTAssertEqual(fields["duration"] as? Double, 3)
        XCTAssertEqual(fields["continuityNotes"] as? String, "Hold akse")
        XCTAssertNil(fields["description"])
        XCTAssertNil(fields["imageUrl"], "A skill patch must never replace artwork")
    }
}
