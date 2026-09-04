// TranscriptIntelligenceTests.swift
//
// Tier 0-verifisering (jf. docs/apple-intelligence-vision-integrasjonsplan §9):
// rute-/fallback-logikken i TranscriptIntelligence testes deterministisk med
// injiserte mocks — INGEN Foundation Models-modell, INGEN nettverk. Kjørbart
// i CI på Xcode 26.6 / iOS 26.5.

import XCTest
@testable import LeadMapApp

final class TranscriptIntelligenceTests: XCTestCase {

    // MARK: - Testdoubler

    private struct MockChecker: OnDeviceAvailabilityChecking {
        let availability: OnDeviceModelAvailability
    }

    private struct FakeAnalyzer: OnDeviceTranscriptAnalyzing {
        let result: TranscriptAnalysis?
        let shouldThrow: Bool
        struct Boom: Error {}
        func analyze(transcript: String, leadName: String) async throws -> TranscriptAnalysis {
            if shouldThrow { throw Boom() }
            return result ?? makeAnalysis("EMPTY")
        }
    }

    // MARK: - Helpers

    private func makeIntel(
        availability: OnDeviceModelAvailability,
        onDevice: OnDeviceTranscriptAnalyzing?,
        maxChars: Int = 6000
    ) -> TranscriptIntelligence {
        let backendMarker = makeAnalysis("BACKEND")
        return TranscriptIntelligence(
            availability: MockChecker(availability: availability),
            onDevice: onDevice,
            maxCharsForOnDevice: maxChars,
            backend: { _, _ in backendMarker }
        )
    }

    private func onDeviceAnalyzer() -> FakeAnalyzer {
        FakeAnalyzer(result: makeAnalysis("ONDEVICE"), shouldThrow: false)
    }

    // MARK: - Tester

    func testAvailableShortTranscript_usesOnDevice() async throws {
        let intel = makeIntel(availability: .available, onDevice: onDeviceAnalyzer())
        let r = try await intel.analyze(transcript: "kort besøksnotat", leadName: "Firma AS")
        XCTAssertEqual(r.source, .onDevice)
        XCTAssertEqual(r.analysis.resolved_text, "ONDEVICE")
    }

    func testDeviceNotEligible_fallsBackToBackend() async throws {
        let intel = makeIntel(availability: .unavailable(.deviceNotEligible), onDevice: onDeviceAnalyzer())
        let r = try await intel.analyze(transcript: "notat", leadName: "Firma AS")
        XCTAssertEqual(r.source, .backend)
        XCTAssertEqual(r.analysis.resolved_text, "BACKEND")
    }

    func testAppleIntelligenceNotEnabled_fallsBackToBackend() async throws {
        let intel = makeIntel(availability: .unavailable(.appleIntelligenceNotEnabled), onDevice: onDeviceAnalyzer())
        let r = try await intel.analyze(transcript: "notat", leadName: "Firma AS")
        XCTAssertEqual(r.source, .backend)
    }

    func testModelNotReady_fallsBackToBackend() async throws {
        let intel = makeIntel(availability: .unavailable(.modelNotReady), onDevice: onDeviceAnalyzer())
        let r = try await intel.analyze(transcript: "notat", leadName: "Firma AS")
        XCTAssertEqual(r.source, .backend)
    }

    func testUnsupportedLanguage_fallsBackToBackend() async throws {
        let intel = makeIntel(availability: .unavailable(.unsupportedLanguage), onDevice: onDeviceAnalyzer())
        let r = try await intel.analyze(transcript: "notat", leadName: "Firma AS")
        XCTAssertEqual(r.source, .backend)
    }

    func testOSUnsupported_fallsBackToBackend() async throws {
        let intel = makeIntel(availability: .unavailable(.osUnsupported), onDevice: onDeviceAnalyzer())
        let r = try await intel.analyze(transcript: "notat", leadName: "Firma AS")
        XCTAssertEqual(r.source, .backend)
    }

    func testAvailableButTooLong_routesToBackend() async throws {
        let intel = makeIntel(availability: .available, onDevice: onDeviceAnalyzer(), maxChars: 10)
        let long = String(repeating: "a", count: 50)
        let r = try await intel.analyze(transcript: long, leadName: "Firma AS")
        XCTAssertEqual(r.source, .backend)
    }

    func testOnDeviceThrows_fallsBackToBackend() async throws {
        let throwing = FakeAnalyzer(result: nil, shouldThrow: true)
        let intel = makeIntel(availability: .available, onDevice: throwing)
        let r = try await intel.analyze(transcript: "notat", leadName: "Firma AS")
        XCTAssertEqual(r.source, .backend)
        XCTAssertEqual(r.analysis.resolved_text, "BACKEND")
    }

    func testNoOnDeviceStack_usesBackend() async throws {
        let intel = makeIntel(availability: .available, onDevice: nil)
        let r = try await intel.analyze(transcript: "notat", leadName: "Firma AS")
        XCTAssertEqual(r.source, .backend)
    }

    func testPrefersOnDevice_matrix() {
        let withDevice = makeIntel(availability: .available, onDevice: onDeviceAnalyzer(), maxChars: 100)
        XCTAssertTrue(withDevice.prefersOnDevice(transcriptLength: 50))
        XCTAssertFalse(withDevice.prefersOnDevice(transcriptLength: 200))   // for langt

        let unavailable = makeIntel(availability: .unavailable(.modelNotReady), onDevice: onDeviceAnalyzer())
        XCTAssertFalse(unavailable.prefersOnDevice(transcriptLength: 10))

        let noStack = makeIntel(availability: .available, onDevice: nil)
        XCTAssertFalse(noStack.prefersOnDevice(transcriptLength: 10))
    }
}

// Fri hjelpefunksjon (utenfor klassen så testdoublene kan bruke den).
private func makeAnalysis(_ marker: String) -> TranscriptAnalysis {
    TranscriptAnalysis(
        resolved_text: marker,
        action_items: [],
        follow_up_date: nil,
        calendar_suggestion: nil,
        sentiment: "nøytral"
    )
}

// MARK: - OfflineActionQueue data-integritet

final class OfflineActionQueueTests: XCTestCase {
    private enum ExpectedFailure: Error { case offline }

    private actor DrainProbe {
        private(set) var executionCount = 0

        func execute() async {
            executionCount += 1
            try? await Task.sleep(nanoseconds: 150_000_000)
        }
    }

    private func temporaryQueueURL() -> URL {
        FileManager.default.temporaryDirectory
            .appendingPathComponent("leadgrid-offline-queue-\(UUID().uuidString).json")
    }

    func testSuccessfulDrainRemovesOnlyCurrentOrganizationAction() async throws {
        let url = temporaryQueueURL()
        defer { try? FileManager.default.removeItem(at: url) }
        let queue = OfflineActionQueue(fileURL: url)
        let now = Date(timeIntervalSince1970: 1_700_000_000)
        await queue.enqueue(.init(
            organizationId: "org-a",
            endpoint: "/api/admin-room/lead-map/leads/a/status",
            httpMethod: "PATCH",
            nextRetryAt: now
        ))
        await queue.enqueue(.init(
            organizationId: "org-b",
            endpoint: "/api/admin-room/lead-map/leads/b/status",
            httpMethod: "PATCH",
            nextRetryAt: now
        ))

        let result = await queue.drain(organizationId: "org-a", now: now) { _ in }
        let pendingA = await queue.pendingCount(organizationId: "org-a")
        let pendingB = await queue.pendingCount(organizationId: "org-b")

        XCTAssertEqual(result.success, 1)
        XCTAssertEqual(result.failed, 0)
        XCTAssertEqual(pendingA, 0)
        XCTAssertEqual(pendingB, 1)
    }

    func testMaxAttemptsRetainsPayloadUntilExplicitRetry() async throws {
        let url = temporaryQueueURL()
        defer { try? FileManager.default.removeItem(at: url) }
        let queue = OfflineActionQueue(fileURL: url, maxAttempts: 2)
        let now = Date(timeIntervalSince1970: 1_700_000_000)
        let id = UUID()
        await queue.enqueue(.init(
            id: id,
            organizationId: "org-a",
            endpoint: "/api/admin-room/lead-map/leads/a/visits",
            bodyJson: Data("{\"visitType\":\"phone\"}".utf8),
            nextRetryAt: now
        ))

        _ = await queue.drain(organizationId: "org-a", now: now) { _ in
            throw ExpectedFailure.offline
        }
        let second = await queue.drain(
            organizationId: "org-a",
            now: now.addingTimeInterval(31)
        ) { _ in
            throw ExpectedFailure.offline
        }
        let pendingAfterFailure = await queue.pendingCount(organizationId: "org-a")
        let failedAfterFailure = await queue.failedCount(organizationId: "org-a")

        XCTAssertEqual(second.failed, 1)
        XCTAssertEqual(pendingAfterFailure, 0)
        XCTAssertEqual(failedAfterFailure, 1)
        let retained = await queue.failedActions(organizationId: "org-a")
        XCTAssertEqual(retained.first?.id, id)
        XCTAssertEqual(retained.first?.bodyJson, Data("{\"visitType\":\"phone\"}".utf8))

        let reset = await queue.retry(id: id, organizationId: "org-a")
        XCTAssertTrue(reset)
        let retried = await queue.drain(
            organizationId: "org-a",
            now: Date().addingTimeInterval(1)
        ) { _ in }
        let failedAfterRetry = await queue.failedCount(organizationId: "org-a")
        XCTAssertEqual(retried.success, 1)
        XCTAssertEqual(failedAfterRetry, 0)
    }

    func testLegacyUnscopedPayloadFailsClosed() async throws {
        let url = temporaryQueueURL()
        defer { try? FileManager.default.removeItem(at: url) }
        let id = UUID()
        let legacy: [[String: Any]] = [[
            "id": id.uuidString,
            "endpoint": "/api/admin-room/lead-map/leads/a/status",
            "httpMethod": "PATCH",
            "createdAt": "2023-11-14T22:13:20Z",
            "attemptCount": 1,
            "nextRetryAt": "2023-11-14T22:13:20Z",
        ]]
        let data = try JSONSerialization.data(withJSONObject: legacy)
        try data.write(to: url, options: .atomic)

        let queue = OfflineActionQueue(fileURL: url)
        let result = await queue.drain(
            organizationId: "org-a",
            now: Date().addingTimeInterval(1)
        ) { _ in
            XCTFail("Legacy-handling uten tenant-scope skal aldri eksekveres")
        }
        let failedCount = await queue.failedCount(organizationId: "org-a")
        let reset = await queue.retry(id: id, organizationId: "org-a")
        let remaining = await queue.pendingActions()

        XCTAssertEqual(result.success, 0)
        XCTAssertEqual(failedCount, 1)
        XCTAssertFalse(reset)
        XCTAssertEqual(remaining.count, 1)
    }

    func testDuplicateWatchDeliveryKeepsOneLogicalAction() async throws {
        let url = temporaryQueueURL()
        defer { try? FileManager.default.removeItem(at: url) }
        let queue = OfflineActionQueue(fileURL: url)
        let id = UUID()
        await queue.enqueue(.init(
            id: id,
            organizationId: "org-a",
            endpoint: "/api/admin-room/lead-map/leads/a/status",
            httpMethod: "PATCH"
        ))
        await queue.enqueue(.init(
            id: id,
            organizationId: "org-a",
            endpoint: "/api/admin-room/lead-map/leads/a/visits",
            httpMethod: "POST"
        ))

        let actions = await queue.pendingActions()
        XCTAssertEqual(actions.count, 1)
        XCTAssertEqual(actions.first?.endpoint, "/api/admin-room/lead-map/leads/a/status")
    }

    func testConcurrentDrainsExecuteEachActionOnlyOnce() async throws {
        let url = temporaryQueueURL()
        defer { try? FileManager.default.removeItem(at: url) }
        let queue = OfflineActionQueue(fileURL: url)
        let probe = DrainProbe()
        let now = Date(timeIntervalSince1970: 1_700_000_000)
        await queue.enqueue(.init(
            organizationId: "org-a",
            endpoint: "/api/admin-room/lead-map/leads/a/status",
            httpMethod: "PATCH",
            nextRetryAt: now
        ))

        async let first = queue.drain(organizationId: "org-a", now: now) { _ in
            await probe.execute()
        }
        async let second = queue.drain(organizationId: "org-a", now: now) { _ in
            await probe.execute()
        }
        let results = await (first, second)
        let executionCount = await probe.executionCount
        let remaining = await queue.pendingCount(organizationId: "org-a")

        XCTAssertEqual(executionCount, 1)
        XCTAssertEqual(results.0.success + results.1.success, 1)
        XCTAssertEqual(results.0.failed + results.1.failed, 0)
        XCTAssertEqual(remaining, 0)
    }

    func testCorruptQueueIsBackedUpAndReported() async throws {
        let url = temporaryQueueURL()
        let directory = url.deletingLastPathComponent()
        let backupPrefix = url.deletingPathExtension().lastPathComponent + ".corrupt-"
        try Data("not-json".utf8).write(to: url, options: .atomic)
        defer {
            try? FileManager.default.removeItem(at: url)
            let backups = (try? FileManager.default.contentsOfDirectory(
                at: directory,
                includingPropertiesForKeys: nil
            )) ?? []
            for backup in backups where backup.lastPathComponent.hasPrefix(backupPrefix) {
                try? FileManager.default.removeItem(at: backup)
            }
        }

        let queue = OfflineActionQueue(fileURL: url)
        let error = await queue.lastPersistenceError
        let backups = try FileManager.default.contentsOfDirectory(
            at: directory,
            includingPropertiesForKeys: nil
        ).filter { $0.lastPathComponent.hasPrefix(backupPrefix) }

        XCTAssertNotNil(error)
        XCTAssertFalse(FileManager.default.fileExists(atPath: url.path))
        XCTAssertEqual(backups.count, 1)
        XCTAssertEqual(try Data(contentsOf: backups[0]), Data("not-json".utf8))
    }

    func testEnqueueReportsPersistenceFailure() async throws {
        let directoryURL = FileManager.default.temporaryDirectory
            .appendingPathComponent("leadgrid-offline-queue-directory-\(UUID().uuidString)")
        try FileManager.default.createDirectory(
            at: directoryURL,
            withIntermediateDirectories: false
        )
        defer { try? FileManager.default.removeItem(at: directoryURL) }
        let queue = OfflineActionQueue(fileURL: directoryURL)

        let persisted = await queue.enqueue(.init(
            organizationId: "org-a",
            endpoint: "/api/admin-room/lead-map/leads/a/status",
            httpMethod: "PATCH"
        ))
        let error = await queue.lastPersistenceError

        XCTAssertFalse(persisted)
        XCTAssertNotNil(error)
    }
    func testPermanentFailureIsVisibleAfterFirstAttempt() async throws {
        let url = temporaryQueueURL()
        defer { try? FileManager.default.removeItem(at: url) }
        let queue = OfflineActionQueue(fileURL: url, maxAttempts: 5)
        let now = Date(timeIntervalSince1970: 1_700_000_000)
        await queue.enqueue(.init(
            organizationId: "org-a",
            endpoint: "/api/admin-room/lead-map/leads",
            nextRetryAt: now
        ))

        let result = await queue.drain(organizationId: "org-a", now: now) { _ in
            throw OfflineActionExecutionError.permanent(
                kind: .authorization,
                message: "Ingen tilgang"
            )
        }
        let failed = await queue.failedActions(organizationId: "org-a")

        XCTAssertEqual(result.failed, 1)
        XCTAssertEqual(failed.first?.attemptCount, 1)
        XCTAssertEqual(failed.first?.failureKind, .authorization)
        XCTAssertEqual(failed.first?.lastError, "Ingen tilgang")
    }

    func testDuplicateOverrideKeepsCreationIdAndSetsAllowDuplicate() async throws {
        let url = temporaryQueueURL()
        defer { try? FileManager.default.removeItem(at: url) }
        let queue = OfflineActionQueue(fileURL: url)
        let id = UUID()
        let body = try JSONSerialization.data(withJSONObject: [
            "creation_id": id.uuidString,
            "organization_id": "org-a",
            "name": "Kunde AS",
            "lead_temperature": "warm",
            "pipeline_stage": "new",
            "lead_status": "unvisited",
            "location_confidence": "unknown",
            "lead_source": "manual",
            "allow_duplicate": false,
        ])
        await queue.enqueue(.init(
            id: id,
            organizationId: "org-a",
            endpoint: "/api/admin-room/lead-map/leads",
            bodyJson: body,
            attemptCount: 1,
            lastError: "Mulig duplikat",
            permanentlyFailedAt: Date(),
            failureKind: .duplicateConflict
        ))

        let reset = await queue.retryLeadCreationAllowingDuplicate(
            id: id,
            organizationId: "org-a"
        )
        let actions = await queue.pendingActions()
        let action = try XCTUnwrap(actions.first)
        let decoder = JSONDecoder()
        decoder.keyDecodingStrategy = .convertFromSnakeCase
        let updated = try decoder.decode(
            LeadDraft.self,
            from: try XCTUnwrap(action.bodyJson)
        )

        XCTAssertTrue(reset)
        XCTAssertEqual(action.id, id)
        XCTAssertEqual(updated.creationId, id)
        XCTAssertTrue(updated.allowDuplicate)
        XCTAssertNil(action.permanentlyFailedAt)
        XCTAssertNil(action.failureKind)
    }
}

// MARK: - Leadgrid realtime connection lifecycle

@MainActor
final class LeadgridRealtimeClientTests: XCTestCase {
    func testChangedConfigurationReplacesSocketDuringHandshake() {
        let currentChannels: Set<String> = ["org:a", "user:1"]

        // Kanalrekkefølge er ikke en konfigurasjonsendring.
        XCTAssertFalse(LeadgridRealtimeClient.requiresReconnect(
            currentBaseURL: "https://one.example.test",
            currentSessionIdentity: "session-a",
            currentChannels: currentChannels,
            requestedBaseURL: "https://one.example.test",
            requestedSessionIdentity: "session-a",
            requestedChannels: ["user:1", "org:a"],
            hasActiveConnection: true
        ))
        XCTAssertTrue(LeadgridRealtimeClient.requiresReconnect(
            currentBaseURL: "https://one.example.test",
            currentSessionIdentity: "session-a",
            currentChannels: currentChannels,
            requestedBaseURL: "https://one.example.test",
            requestedSessionIdentity: "session-b",
            requestedChannels: currentChannels,
            hasActiveConnection: true
        ))
        XCTAssertTrue(LeadgridRealtimeClient.requiresReconnect(
            currentBaseURL: "https://one.example.test",
            currentSessionIdentity: "session-a",
            currentChannels: currentChannels,
            requestedBaseURL: "https://two.example.test",
            requestedSessionIdentity: "session-a",
            requestedChannels: currentChannels,
            hasActiveConnection: true
        ))
        XCTAssertTrue(LeadgridRealtimeClient.requiresReconnect(
            currentBaseURL: "https://one.example.test",
            currentSessionIdentity: "session-a",
            currentChannels: currentChannels,
            requestedBaseURL: "https://one.example.test",
            requestedSessionIdentity: "session-a",
            requestedChannels: ["org:b"],
            hasActiveConnection: true
        ))
        XCTAssertTrue(LeadgridRealtimeClient.requiresReconnect(
            currentBaseURL: "https://one.example.test",
            currentSessionIdentity: "session-a",
            currentChannels: currentChannels,
            requestedBaseURL: "https://one.example.test",
            requestedSessionIdentity: "session-a",
            requestedChannels: currentChannels,
            hasActiveConnection: false
        ))
    }
}


// MARK: - Canonical lead creation contract

@MainActor
final class LeadCreationContractTests: XCTestCase {
    private func makeDraft() -> LeadDraft {
        LeadDraft(
            creationId: UUID(uuidString: "11111111-2222-3333-4444-555555555555")!,
            organizationId: "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee",
            name: "Nordic Elektro AS",
            company: "Nordic Elektro AS",
            organizationNumber: "937518684",
            websiteUrl: "https://nordicelektro.no",
            contactName: "Ada Nordmann",
            contactRole: "Daglig leder",
            email: "ada@nordicelektro.no",
            phone: "+47 999 88 777",
            address: "Storgata 1",
            postalCode: "0155",
            city: "Oslo",
            country: "NO",
            latitude: 59.91,
            longitude: 10.75,
            googlePlaceId: "place-1",
            industryId: nil,
            industry: "Elektro",
            employeeCountEstimate: 38,
            annualRevenueNokEstimate: 15_000_000,
            estimatedValue: 250_000,
            notes: "Ring på tirsdag",
            leadTemperature: "hot",
            pipelineStage: "qualified",
            leadStatus: "interested",
            nextFollowUpAt: "2026-09-08T08:00:00+02:00",
            nextAction: "Ring",
            locationConfidence: "geocoded",
            leadSource: "company_lookup",
            projectId: "leadgrid-project-2026",
            rawText: nil,
            allowDuplicate: false
        )
    }

    func testQueuedActionPreservesTenantCreationIdAndEveryCapturedField() throws {
        let draft = makeDraft()
        let action = try OfflineResilientActions.makeLeadCreationAction(draft: draft)
        let body = try XCTUnwrap(action.bodyJson)
        let payload = try XCTUnwrap(
            JSONSerialization.jsonObject(with: body) as? [String: Any]
        )

        XCTAssertEqual(action.id, draft.creationId)
        XCTAssertEqual(action.organizationId, draft.organizationId)
        XCTAssertEqual(action.endpoint, "/api/admin-room/lead-map/leads")
        XCTAssertEqual(action.httpMethod, "POST")
        XCTAssertEqual(payload["creation_id"] as? String, draft.creationId.uuidString)
        XCTAssertEqual(payload["organization_id"] as? String, draft.organizationId)
        XCTAssertEqual(payload["organization_number"] as? String, "937518684")
        XCTAssertEqual(payload["contact_name"] as? String, "Ada Nordmann")
        XCTAssertEqual(payload["contact_role"] as? String, "Daglig leder")
        XCTAssertEqual(payload["employee_count_estimate"] as? Int, 38)
        XCTAssertEqual(payload["annual_revenue_nok_estimate"] as? Double, 15_000_000)
        XCTAssertEqual(payload["lead_temperature"] as? String, "hot")
        XCTAssertEqual(payload["pipeline_stage"] as? String, "qualified")
        XCTAssertEqual(payload["lead_status"] as? String, "interested")
        XCTAssertEqual(payload["project_id"] as? String, draft.projectId)
        XCTAssertNil(payload["creationId"])
        XCTAssertNil(payload["raw_text"])
    }

    func testNorwegianNumericInputsBecomeStructuredEstimates() {
        XCTAssertEqual(LeadDraft.employeeEstimate(from: "25-50 ansatte"), 38)
        XCTAssertEqual(LeadDraft.employeeEstimate(from: "120"), 120)
        XCTAssertNil(LeadDraft.employeeEstimate(from: "ukjent"))

        XCTAssertEqual(LeadDraft.nokEstimate(from: "10-20 mill."), 15_000_000)
        XCTAssertEqual(LeadDraft.nokEstimate(from: "1,5 mrd"), 1_500_000_000)
        XCTAssertEqual(LeadDraft.nokEstimate(from: "10 000 000"), 10_000_000)
        XCTAssertNil(LeadDraft.nokEstimate(from: "ukjent"))
    }

    func testPinStatusesMapToBackendEnums() {
        XCTAssertEqual(
            LeadDraftClassification.from(pinStatusRawValue: "new"),
            .init(temperature: "cold", pipelineStage: "new", leadStatus: "unvisited")
        )
        XCTAssertEqual(
            LeadDraftClassification.from(pinStatusRawValue: "meeting"),
            .init(temperature: "hot", pipelineStage: "meeting", leadStatus: "meeting_booked")
        )
        XCTAssertEqual(
            LeadDraftClassification.from(pinStatusRawValue: "customer"),
            .init(temperature: "ready", pipelineStage: "won", leadStatus: "won")
        )
    }

    func testOptionalTextTrimsAndOmitsEmptyValues() {
        XCTAssertNil(LeadDraft.optionalText("  \n "))
        XCTAssertEqual(LeadDraft.optionalText("  Kunde AS  "), "Kunde AS")
    }

    func testDraftValidationMirrorsBackendContract() {
        var draft = makeDraft()
        XCTAssertTrue(draft.validationIssues().isEmpty)

        draft.email = "ikke-en-epost"
        draft.organizationNumber = "123456789"
        draft.longitude = nil
        draft.contactRole = String(repeating: "R", count: 161)
        let details = draft.validationDetails()
        let issues = details.map(\.message)

        XCTAssertTrue(issues.contains("E-postadressen er ugyldig."))
        XCTAssertTrue(issues.contains("Organisasjonsnummeret er ugyldig."))
        XCTAssertTrue(issues.contains("Breddegrad og lengdegrad må angis sammen."))
        XCTAssertTrue(issues.contains("Rolle kan være maks 160 tegn."))
        XCTAssertTrue(details.contains {
            $0.field == .email && $0.message == "E-postadressen er ugyldig."
        })
        XCTAssertTrue(details.contains {
            $0.field == .organizationNumber
        })
        XCTAssertTrue(details.contains { $0.field == .coordinates })
        XCTAssertTrue(details.contains { $0.field == .contactRole })
    }
}
