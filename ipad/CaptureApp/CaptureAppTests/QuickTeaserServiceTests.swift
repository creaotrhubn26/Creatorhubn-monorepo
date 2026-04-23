import XCTest
@testable import CaptureApp

/// Tests for ``QuickTeaserService``. We exercise:
///   - Eligibility counts for each filter + non-rejected gate.
///   - Validation (missing name / invalid email) refuses to POST.
///   - Empty-result branch short-circuits before calling backend.
///   - Backend errors map cleanly onto ``Failure`` cases the UI
///     renders.
///
/// We inject a mock ``BackendClient`` sub-conformer. Can't pass a
/// real URLSession-backed client since that would require a live
/// server. The real backend is exercised via integration tests in
/// CI when the auth bridge lands.
final class QuickTeaserServiceTests: XCTestCase {
    private let owner = "photographer-1"

    private func makeStack(
        eligibleAssetsScript: [AssetShape] = [],
        sendOutcome: MockBackend.SendOutcome = .success(
            BackendDeliverToShowcaseResponse(
                galleryId: "gal-1",
                accessToken: "tok-abc",
                shareUrl: "https://app.creatorhubn.com/client/gallery/tok-abc",
                uploadedImageCount: 3,
                reusedExisting: false,
            ),
        ),
    ) async throws -> (QuickTeaserService, MockBackend, AppDatabase, UUID) {
        let db = try AppDatabase.inMemory()
        let sessionId = UUID()

        // Seed session + assets.
        let session = Session(
            id: sessionId,
            name: "Bryllup",
            clientId: nil,
            startsAt: Date(),
            endsAt: nil,
            status: .active,
            ownerUserId: owner,
            createdAt: Date(),
            updatedAt: Date(),
        )
        try await db.dbWriter.write { db in
            try session.insert(db)
        }

        for shape in eligibleAssetsScript {
            let asset = Asset(
                id: UUID(),
                sessionId: sessionId,
                originalFilename: "IMG.CR3",
                captureTime: Date(),
                previewKey: nil,
                fullKey: nil,
                rawKey: nil,
                enhancedKey: nil,
                checksumSha256: nil,
                mime: "image/jpeg",
                sizeBytes: nil,
                state: .anticipated,
                signals: AssetSignals(),
                rating: shape.rating,
                colorLabel: nil,
                flaggedForClient: shape.flagged,
                rejected: shape.rejected,
                createdAt: Date(),
                updatedAt: Date(),
            )
            try await db.dbWriter.write { db in
                try asset.insert(db)
            }
        }

        let mock = MockBackend(outcome: sendOutcome)
        let service = QuickTeaserService(database: db, backend: mock)
        return (service, mock, db, sessionId)
    }

    struct AssetShape {
        let rating: Int
        let flagged: Bool
        let rejected: Bool
    }

    // MARK: - Eligibility

    func testEligibleCountForFlaggedExcludesRejected() async throws {
        let (service, _, _, sessionId) = try await makeStack(eligibleAssetsScript: [
            AssetShape(rating: 5, flagged: true, rejected: false),
            AssetShape(rating: 0, flagged: true, rejected: true),  // rejected → excluded
            AssetShape(rating: 5, flagged: true, rejected: false),
            AssetShape(rating: 0, flagged: false, rejected: false),
        ])
        let count = try await service.eligibleCount(
            sessionId: sessionId,
            ownerUserId: owner,
            filter: .flagged,
        )
        XCTAssertEqual(count, 2,
            "rejected frames must never be delivered even if flagged")
    }

    func testEligibleCountForRatingAtLeast4() async throws {
        let (service, _, _, sessionId) = try await makeStack(eligibleAssetsScript: [
            AssetShape(rating: 5, flagged: false, rejected: false),
            AssetShape(rating: 4, flagged: false, rejected: false),
            AssetShape(rating: 3, flagged: false, rejected: false),   // excluded
            AssetShape(rating: 0, flagged: false, rejected: false),
        ])
        let count = try await service.eligibleCount(
            sessionId: sessionId,
            ownerUserId: owner,
            filter: .ratingAtLeast4,
        )
        XCTAssertEqual(count, 2)
    }

    func testEligibleCountForPicksOr4PlusUnionsBoth() async throws {
        let (service, _, _, sessionId) = try await makeStack(eligibleAssetsScript: [
            AssetShape(rating: 5, flagged: false, rejected: false),  // counts via rating
            AssetShape(rating: 0, flagged: true, rejected: false),   // counts via flag
            AssetShape(rating: 0, flagged: false, rejected: false),  // excluded
        ])
        let count = try await service.eligibleCount(
            sessionId: sessionId,
            ownerUserId: owner,
            filter: .picksOr4Plus,
        )
        XCTAssertEqual(count, 2)
    }

    func testOtherPhotographersSessionReturnsZero() async throws {
        let (service, _, _, sessionId) = try await makeStack(eligibleAssetsScript: [
            AssetShape(rating: 5, flagged: true, rejected: false),
        ])
        let count = try await service.eligibleCount(
            sessionId: sessionId,
            ownerUserId: "someone-else",
            filter: .flagged,
        )
        XCTAssertEqual(count, 0,
            "eligibility never leaks another photographer's flagged frames")
    }

    // MARK: - Validation

    func testMissingClientNameRefusesPost() async throws {
        let (service, mock, _, sessionId) = try await makeStack()
        do {
            _ = try await service.deliver(
                sessionId: sessionId,
                ownerUserId: owner,
                clientName: "  ",
                clientEmail: "anna@example.com",
                projectTitle: nil,
            )
            XCTFail("missing name should throw")
        } catch QuickTeaserService.Failure.missingClientName {
            // good
        }
        let sent = await mock.sentBodies
        XCTAssertTrue(sent.isEmpty, "validation must short-circuit before backend call")
    }

    func testInvalidEmailRefusesPost() async throws {
        let (service, mock, _, sessionId) = try await makeStack()
        do {
            _ = try await service.deliver(
                sessionId: sessionId,
                ownerUserId: owner,
                clientName: "Anna",
                clientEmail: "ikke-en-epost",
                projectTitle: nil,
            )
            XCTFail("invalid email should throw")
        } catch QuickTeaserService.Failure.invalidEmail {
            // good
        }
        // Resolve the actor-isolated property before the XCTAssertEqual
        // autoclosure so Swift 6 doesn't complain about ``await`` in
        // a non-concurrent autoclosure context.
        let sent = await mock.sentBodies
        XCTAssertEqual(sent.count, 0)
    }

    func testNoEligiblePicksShortCircuitsBeforeBackend() async throws {
        let (service, mock, _, sessionId) = try await makeStack(eligibleAssetsScript: [
            AssetShape(rating: 0, flagged: false, rejected: false),
        ])
        do {
            _ = try await service.deliver(
                sessionId: sessionId,
                ownerUserId: owner,
                clientName: "Anna",
                clientEmail: "anna@example.com",
                projectTitle: "Bryllup",
                filter: .flagged,
            )
            XCTFail("no eligible picks should throw")
        } catch let QuickTeaserService.Failure.noEligiblePicks(filter) {
            XCTAssertEqual(filter, .flagged)
        }
        let sent = await mock.sentBodies
        XCTAssertEqual(sent.count, 0)
    }

    // MARK: - Happy path

    func testSuccessfulDeliveryForwardsFieldsAndReturnsResponse() async throws {
        let response = BackendDeliverToShowcaseResponse(
            galleryId: "gal-xyz",
            accessToken: "tok-xyz",
            shareUrl: "https://app.creatorhubn.com/client/gallery/tok-xyz",
            uploadedImageCount: 5,
            reusedExisting: false,
        )
        let (service, mock, _, sessionId) = try await makeStack(
            eligibleAssetsScript: [
                AssetShape(rating: 5, flagged: true, rejected: false),
                AssetShape(rating: 5, flagged: true, rejected: false),
            ],
            sendOutcome: .success(response),
        )
        let result = try await service.deliver(
            sessionId: sessionId,
            ownerUserId: owner,
            clientName: "Anna Hansen",
            clientEmail: "anna@example.com",
            projectTitle: "Anna+Per bryllup",
        )
        XCTAssertEqual(result.shareUrl, response.shareUrl)
        XCTAssertEqual(result.uploadedImageCount, 5)

        let sent = await mock.sentBodies
        XCTAssertEqual(sent.count, 1)
        XCTAssertEqual(sent[0].clientName, "Anna Hansen")
        XCTAssertEqual(sent[0].clientEmail, "anna@example.com")
        XCTAssertEqual(sent[0].projectTitle, "Anna+Per bryllup")
        XCTAssertEqual(sent[0].filter, .flagged)
    }

    func testEmptyProjectTitleIsNormalisedToNil() async throws {
        let (service, mock, _, sessionId) = try await makeStack(eligibleAssetsScript: [
            AssetShape(rating: 5, flagged: true, rejected: false),
        ])
        _ = try await service.deliver(
            sessionId: sessionId,
            ownerUserId: owner,
            clientName: "Anna",
            clientEmail: "anna@example.com",
            projectTitle: "",
        )
        let sent = await mock.sentBodies
        XCTAssertNil(sent.first?.projectTitle,
            "whitespace-only title should be nil over the wire")
    }

    // MARK: - Backend error mapping

    func testBackendUnauthorisedMapsToNotAuthorised() async throws {
        let (service, _, _, sessionId) = try await makeStack(
            eligibleAssetsScript: [
                AssetShape(rating: 5, flagged: true, rejected: false),
            ],
            sendOutcome: .error(BackendError.unauthorized),
        )
        do {
            _ = try await service.deliver(
                sessionId: sessionId,
                ownerUserId: owner,
                clientName: "Anna",
                clientEmail: "anna@example.com",
                projectTitle: nil,
            )
            XCTFail("unauthorized should throw")
        } catch QuickTeaserService.Failure.notAuthorised {
            // good
        }
    }

    func testBackendNotFoundMapsToSessionNotFound() async throws {
        let (service, _, _, sessionId) = try await makeStack(
            eligibleAssetsScript: [
                AssetShape(rating: 5, flagged: true, rejected: false),
            ],
            sendOutcome: .error(BackendError.notFound),
        )
        do {
            _ = try await service.deliver(
                sessionId: sessionId,
                ownerUserId: owner,
                clientName: "Anna",
                clientEmail: "anna@example.com",
                projectTitle: nil,
            )
            XCTFail("not-found should throw")
        } catch QuickTeaserService.Failure.sessionNotFound {
            // good
        }
    }

    func testBackendHttpErrorMapsToServerRejected() async throws {
        let (service, _, _, sessionId) = try await makeStack(
            eligibleAssetsScript: [
                AssetShape(rating: 5, flagged: true, rejected: false),
            ],
            sendOutcome: .error(BackendError.httpStatus(500, body: "boom")),
        )
        do {
            _ = try await service.deliver(
                sessionId: sessionId,
                ownerUserId: owner,
                clientName: "Anna",
                clientEmail: "anna@example.com",
                projectTitle: nil,
            )
            XCTFail("500 should throw")
        } catch let QuickTeaserService.Failure.serverRejected(status, body) {
            XCTAssertEqual(status, 500)
            XCTAssertEqual(body, "boom")
        }
    }
}

// MARK: - Test backend

/// Minimal ``QuickTeaserBackend`` stand-in that records sent bodies
/// and replays a scripted outcome. Implemented as an actor (not an
/// ``NSLock``-based class) because Swift 6 forbids ``lock()``/
/// ``unlock()`` calls from ``async`` contexts — actors give us the
/// same thread-safety guarantee in the language-native way.
actor MockBackend: QuickTeaserBackend {
    enum SendOutcome {
        case success(BackendDeliverToShowcaseResponse)
        case error(Error)
    }

    private let outcome: SendOutcome
    private var recordedBodies: [BackendDeliverToShowcaseRequest] = []

    init(outcome: SendOutcome) {
        self.outcome = outcome
    }

    /// Bodies sent to ``deliverToShowcase`` in the order they arrived.
    var sentBodies: [BackendDeliverToShowcaseRequest] {
        recordedBodies
    }

    func deliverToShowcase(
        sessionId: UUID,
        body: BackendDeliverToShowcaseRequest,
    ) async throws -> BackendDeliverToShowcaseResponse {
        recordedBodies.append(body)
        switch outcome {
        case let .success(response): return response
        case let .error(error): throw error
        }
    }
}
