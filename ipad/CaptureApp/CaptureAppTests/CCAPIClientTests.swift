import XCTest
@testable import CaptureApp

final class CCAPIInventoryTests: XCTestCase {
    func testDecodesVersionedInventory() throws {
        // R6 Mark II wire format: top-level dict keyed by version string,
        // each value is the endpoint array for that version.
        let json = #"""
        {
          "ver100": [
            {"path":"/ccapi/ver100/deviceinformation","get":true,"post":false,"put":false,"delete":false},
            {"path":"/ccapi/ver100/event/monitoring","get":true,"post":false,"put":false,"delete":true}
          ],
          "ver110": [
            {"path":"/ccapi/ver110/event/polling","get":true,"post":false,"put":false,"delete":true}
          ],
          "ver140": [
            {"path":"/ccapi/ver140/shooting/control/shutterbutton","get":false,"post":true,"put":false,"delete":false}
          ]
        }
        """#.data(using: .utf8)!

        let inventory = try JSONDecoder().decode(CCAPIInventory.self, from: json)
        XCTAssertEqual(inventory.versions.count, 3)
        XCTAssertTrue(inventory.supports(path: "/ccapi/ver100/deviceinformation"))
        XCTAssertTrue(inventory.supports(path: "/ccapi/ver110/event/polling"))
        XCTAssertFalse(inventory.supports(path: "/ccapi/ver100/shooting/bracket"))
        XCTAssertEqual(inventory.latestVersion(for: "/ccapi/ver100/deviceinformation"), "ver100")
    }

    func testPollingResponseDecodesPartialPayload() throws {
        // Real polling responses only include fields that changed. Our decoder
        // tolerates any subset.
        let json = #"""
        { "addedcontents": ["/ccapi/ver130/contents/sd/DCIM/100CANON/IMG_0001.JPG"] }
        """#.data(using: .utf8)!
        let response = try JSONDecoder().decode(CCAPIPollingResponse.self, from: json)
        XCTAssertEqual(response.addedcontents?.count, 1)
        XCTAssertNil(response.batterylist)
        XCTAssertNil(response.temperature)
    }
}
