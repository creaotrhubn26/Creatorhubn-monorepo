import XCTest
import UIKit
@testable import LeadMapApp

final class ProfileValidationTests: XCTestCase {
    func testDraftNormalizesWhitespaceAndEncodesExplicitNulls() throws {
        let draft = ProfileDraft(
            firstName: "  Ada ",
            lastName: "   ",
            phone: " +47 900 00 000 ",
            profession: " Selger "
        )

        XCTAssertTrue(draft.validationErrors.isEmpty)
        XCTAssertEqual(draft.updateRequest.firstName, "Ada")
        XCTAssertNil(draft.updateRequest.lastName)
        XCTAssertEqual(draft.updateRequest.phone, "+47 900 00 000")

        let data = try JSONEncoder().encode(draft.updateRequest)
        let json = try XCTUnwrap(JSONSerialization.jsonObject(with: data) as? [String: Any])
        XCTAssertEqual(json["first_name"] as? String, "Ada")
        XCTAssertTrue(json["last_name"] is NSNull)
        XCTAssertEqual(json["phone"] as? String, "+47 900 00 000")
        XCTAssertNil(json["email"], "E-post skal aldri kunne sendes i vanlig profil-PATCH")
        XCTAssertNil(json["profile_image_url"], "Bilde-URL skal eies av upload-endepunktet")
    }

    func testDraftReportsFieldSpecificPhoneAndLengthErrors() {
        let draft = ProfileDraft(
            firstName: String(repeating: "A", count: ProfileDraft.firstNameMaxLength + 1),
            phone: "ring meg",
            profession: String(repeating: "S", count: ProfileDraft.professionMaxLength + 1)
        )
        let errors = draft.validationErrors
        XCTAssertNotNil(errors[.firstName])
        XCTAssertEqual(errors[.phone], "Skriv et gyldig telefonnummer.")
        XCTAssertNotNil(errors[.profession])
        XCTAssertNil(errors[.lastName])
    }

    func testPhoneAcceptsCommonNorwegianFormattingAndDigitBounds() {
        XCTAssertNil(ProfileDraft(phone: "+47 (900) 00-000").validationErrors[.phone])
        XCTAssertNotNil(ProfileDraft(phone: "1234").validationErrors[.phone])
        XCTAssertNotNil(ProfileDraft(phone: "+47 900 00 000 ext 2").validationErrors[.phone])
        XCTAssertNotNil(ProfileDraft(phone: String(repeating: "1", count: 16)).validationErrors[.phone])
    }

    func testFullNameDropsBlankComponents() {
        let profile = MyProfile(
            userId: "u1",
            firstName: " Ada ",
            lastName: "  ",
            email: "ada@example.no",
            phone: nil,
            profession: nil,
            profileImageUrl: nil,
            profileComplete: false,
            profileCompletedCount: 1,
            profileTotalRequired: 4
        )
        XCTAssertEqual(profile.fullName, "Ada")
    }

    func testStructuredValidationErrorIsNotRetryable() {
        let error = APIError.validation(["phone": "Ugyldig telefon"])
        XCTAssertEqual(error.localizedDescription, "Ugyldig telefon")
        XCTAssertFalse(error.isRetryable)
    }
}

@MainActor
final class ProfileStoreTests: XCTestCase {
    func testQASaveUpdatesSharedProfileWithoutNetwork() async throws {
        let store = ProfileStore()
        store.seedForQA(email: "ada@example.no")

        let updated = try await store.save(ProfileDraft(
            firstName: " Grace ",
            lastName: " Hopper ",
            phone: "+47 988 77 666",
            profession: " Admiral "
        ))

        XCTAssertEqual(updated.fullName, "Grace Hopper")
        XCTAssertEqual(store.profile?.profession, "Admiral")
        XCTAssertEqual(store.loadState, .loaded)
    }

    func testImageProcessorProducesBoundedJPEG() throws {
        let source = UIGraphicsImageRenderer(size: CGSize(width: 2_000, height: 1_200)).image { context in
            UIColor.systemPurple.setFill()
            context.cgContext.fill(CGRect(x: 0, y: 0, width: 2_000, height: 1_200))
        }
        let png = try XCTUnwrap(source.pngData())
        let jpeg = try ProfileImageProcessor.jpegData(from: png)

        XCTAssertLessThanOrEqual(jpeg.count, ProfileImageProcessor.maximumUploadBytes)
        XCTAssertEqual(Array(jpeg.prefix(3)), [0xff, 0xd8, 0xff])
    }
}
