import XCTest
@testable import CaptureApp

final class CCAPIAdapterUUIDTests: XCTestCase {
    func testDeterministicUUIDIsStable() {
        let url = "/ccapi/ver130/contents/sd/DCIM/100CANON/IMG_0001.JPG"
        let a = CCAPIAdapter.deterministicUUID(for: url)
        let b = CCAPIAdapter.deterministicUUID(for: url)
        XCTAssertEqual(a, b)
    }

    func testDeterministicUUIDDiffersByContentURL() {
        let a = CCAPIAdapter.deterministicUUID(for: "…/IMG_0001.JPG")
        let b = CCAPIAdapter.deterministicUUID(for: "…/IMG_0002.JPG")
        XCTAssertNotEqual(a, b)
    }

    func testDeterministicUUIDSetsVersionAndVariantBits() {
        let id = CCAPIAdapter.deterministicUUID(for: "any-url")
        let bytes = withUnsafeBytes(of: id.uuid) { Data($0) }
        // Version is the high nibble of byte 6.
        XCTAssertEqual(bytes[6] & 0xF0, 0x50)
        // Variant is the top 2 bits of byte 8 (10xxxxxx).
        XCTAssertEqual(bytes[8] & 0xC0, 0x80)
    }
}
