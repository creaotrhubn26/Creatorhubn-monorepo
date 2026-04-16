import XCTest
@testable import CaptureApp

final class CCAPIInventoryTests: XCTestCase {
    func testDecodesVersionedInventory() throws {
        let json = #"""
        {
          "versions": [
            {
              "ver": "ver100",
              "apis": [
                {"path":"/ccapi/ver100/deviceinformation","get":true},
                {"path":"/ccapi/ver100/event/polling","get":true}
              ]
            },
            {
              "ver": "ver140",
              "apis": [
                {"path":"/ccapi/ver140/shooting/control/shutterbutton","post":true}
              ]
            }
          ]
        }
        """#.data(using: .utf8)!

        let inventory = try JSONDecoder().decode(CCAPIInventory.self, from: json)
        XCTAssertEqual(inventory.versions.count, 2)
        XCTAssertTrue(inventory.supports(path: "/ccapi/ver100/deviceinformation"))
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
