import XCTest
@testable import StoryboardStudio

final class AIStoryboardStudioTests: XCTestCase {
    func testStoryboardRecordLookupMatchesBothServerKeyFormats() {
        let payload: [String: Any] = [
            "data": [
                ["id": "other", "frameId": "frame-2"],
                ["id": "camel", "frameId": "frame-3"],
                ["id": "snake", "frame_id": "frame-4"],
            ],
        ]

        XCTAssertEqual(
            StoryboardRecordLookup.existingID(in: payload, frameId: "frame-3"),
            "camel")
        XCTAssertEqual(
            StoryboardRecordLookup.existingID(in: payload, frameId: "frame-4"),
            "snake")
        XCTAssertNil(
            StoryboardRecordLookup.existingID(in: payload, frameId: "missing"))
    }

    func testAIVersionDictionaryRoundTripPreservesSelectionData() throws {
        let original = AIImageVersion(
            id: "version-1",
            imageURL: "/api/storage/download/generated-frame.jpg",
            prompt: "Cinematic storyboard concept frame",
            styleID: StoryboardAIStyle.noir.id,
            generatedAt: "2026-08-25T20:00:00Z",
            revisedPrompt: "A high-contrast noir frame")

        let decoded = try XCTUnwrap(AIImageVersion(dictionary: original.dictionary))

        XCTAssertEqual(decoded, original)
        XCTAssertEqual(decoded.dictionary["imageURL"], original.imageURL)
    }

    func testAIVersionRejectsPayloadWithoutStoredImage() {
        let invalid: [String: Any] = [
            "id": "version-1",
            "prompt": "Missing image",
        ]

        XCTAssertNil(AIImageVersion(dictionary: invalid))
    }

    func testAIVideoVersionRoundTripPersistsJobInsteadOfExpiringURL() throws {
        let original = AIVideoVersion(
            id: "123E4567-E89B-12D3-A456-426614174000",
            modelID: "longcat-video-i2v",
            provider: "longcat",
            label: "LongCat 720p",
            prompt: "Slow dolly in",
            duration: 4,
            generatedAt: "2026-08-25T21:00:00Z")

        let decoded = try XCTUnwrap(AIVideoVersion(dictionary: original.dictionary))

        XCTAssertEqual(decoded, original)
        XCTAssertNil(original.dictionary["videoURL"], "Signed B2 URLs must not be persisted")
    }

    func testStorageDownloadPathAcceptsOnlyExactStoryboardStorageURL() {
        let id = "123E4567-E89B-12D3-A456-426614174000"

        XCTAssertEqual(StorageDownloadPath.fileID(
            from: "/api/role-room/storage/files/\(id)/download"), id)
        XCTAssertEqual(StorageDownloadPath.fileID(
            from: "https://creatorhub.no/api/role-room/storage/files/\(id)/download?x=1"), id)
        XCTAssertNil(StorageDownloadPath.fileID(from: "https://evil.example/\(id)"))
        XCTAssertNil(StorageDownloadPath.fileID(
            from: "/api/role-room/storage/files/not-a-uuid/download"))
    }

    func testStorageUploadFilenameBlocksMultipartHeaderInjection() {
        let unsafe = "Project\"\r\nX-Evil: yes/shot.jpg"
        let safe = StorageUploadFilename.sanitized(unsafe)

        XCTAssertEqual(safe, "Project---X-Evil- yes-shot.jpg")
        XCTAssertFalse(safe.contains("\r"))
        XCTAssertFalse(safe.contains("\n"))
        XCTAssertFalse(safe.contains("\""))
        XCTAssertLessThanOrEqual(safe.count, 180)
    }

    func testEveryAIStyleHasStablePromptInstructions() {
        XCTAssertEqual(Set(StoryboardAIStyle.allCases.map(\.id)).count,
                       StoryboardAIStyle.allCases.count)
        for style in StoryboardAIStyle.allCases {
            XCTAssertFalse(style.title.isEmpty)
            XCTAssertFalse(style.promptNote.isEmpty)
            XCTAssertTrue(style.promptNote.localizedCaseInsensitiveContains("no text"),
                          "\(style.title) must prevent accidental labels in the frame")
        }
    }

    func testShotContextSerializesManuscriptCameraAndContinuity() throws {
        let context = StoryboardAIShotContext(
            manuscriptTitle: "TROLL — Manuskript v1",
            sceneId: "scene-3",
            sceneNumber: 3,
            sceneHeading: "INT. TOG — NATT",
            intExt: "INT",
            location: "Dovrefjell",
            sceneTimeOfDay: "NATT",
            sceneAction: "Nora følger en pulserende rute idet toget går inn i mørket.",
            characters: ["Nora"],
            shotId: "frame-3b",
            shotNumber: "3B",
            shotDescription: "Et troll-omriss speiles i vinduet bak Nora.",
            shotNotes: "Avslør omrisset sent.",
            shotType: "OTS",
            lensMm: 50,
            movement: "Push In",
            durationSec: 4,
            transition: "Cut",
            focusDepth: "Shallow",
            shotTimeOfDay: "NATT",
            weather: "Snøstorm",
            beat: "Varsel",
            tags: ["mystery"],
            previous: .init(shotNumber: "3A", description: "Nora ser på skjermen."),
            next: .init(shotNumber: "3C", description: "Tunnellyset forsvinner."),
            directorNote: "Varm skjermglød mot kald refleksjon.",
            visualStyle: StoryboardAIStyle.storyPencil.promptNote,
            styleProfileId: StoryboardAIStyle.storyPencil.id,
            cameraAngle: "Low Angle",
            lighting: "Varm skjermglød mot kald refleksjon.")

        let data = try XCTUnwrap(context.serializedJSON?.data(using: .utf8))
        let json = try XCTUnwrap(
            JSONSerialization.jsonObject(with: data) as? [String: Any])
        XCTAssertEqual(json["version"] as? String, "storyboard-shot-v1")
        XCTAssertEqual((json["scene"] as? [String: Any])?["characters"] as? [String], ["Nora"])
        XCTAssertEqual((json["project"] as? [String: Any])?["styleProfileId"] as? String, "story-pencil")
        XCTAssertEqual((json["shot"] as? [String: Any])?["movement"] as? String, "Push In")
        XCTAssertEqual((json["shot"] as? [String: Any])?["angle"] as? String, "Low Angle")
        XCTAssertEqual((json["shot"] as? [String: Any])?["lighting"] as? String,
                       "Varm skjermglød mot kald refleksjon.")
        XCTAssertEqual(((json["production"] as? [String: Any])?["characters"] as? [[String: Any]])?.count, 1)
        XCTAssertTrue(context.legacySceneDescription.contains("PREVIOUS SHOT 3A"))
        XCTAssertTrue(context.legacySceneDescription.contains("NEXT SHOT 3C"))
        XCTAssertLessThanOrEqual(context.legacySceneDescription.count, 2_000)
    }

    func testRoleRoomCharacterIdentifierBecomesHumanName() {
        XCTAssertEqual(
            StoryboardCharacterName.display("troll-1780071501773-role-nora"),
            "Nora")
        XCTAssertEqual(StoryboardCharacterName.display("Jean-Luc"), "Jean-Luc")
    }

    func testPromptEngineResultDecodesInspectorAndModules() throws {
        let payload: [String: Any] = [
            "version": "trr-prompt-engine-v1",
            "contextFingerprint": "abc123",
            "intentKind": "storyboard-image",
            "compiledPrompt": "compiled",
            "modules": [[
                "id": "camera", "label": "CAMERA",
                "constraints": [[
                    "id": "lens", "text": "50 mm lens.",
                    "source": "shot", "locked": true,
                ]],
            ]],
            "validation": ["valid": true, "issues": []],
            "inspector": [
                "intent": "Generate low-angle MCU",
                "inheritedConstraintCount": 18,
                "characterCount": 1,
                "characterReferenceCount": 3,
                "locationReferenceCount": 1,
                "styleProfileLabel": "TRR Story Pencil",
                "lockedProperties": ["identity", "costume"],
                "model": [
                    "id": "gpt-image-2", "label": "GPT Image 2",
                    "provider": "OpenAI",
                ],
            ],
        ]

        let result = try StoryboardPromptEngineResult(dictionary: payload)

        XCTAssertEqual(result.userIntent, "Generate low-angle MCU")
        XCTAssertEqual(result.characterReferenceCount, 3)
        XCTAssertEqual(result.modules.first?.constraints.first?.text, "50 mm lens.")
        XCTAssertTrue(result.validationValid)
    }
}
