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
        XCTAssertNil(response.totalContentsCount)
    }

    func testPollingResponseTolerantsRealR6mkIIDiff() throws {
        // Verbatim payload captured from R6 mkII firmware 1.6.0 after one
        // shutter release — has addedcontents plus the full wrapped-object
        // camera-state diff we don't model. Decoder must skip unknown fields
        // without throwing.
        let json = #"""
        {
          "storage": {"storagelist": [{"name":"card1","path":"/ccapi/ver120/contents/card1","accesscapability":"readwrite","maxsize":511801556992,"spacesize":488993718272,"contentsnumber":2113}]},
          "addedcontents": ["/ccapi/ver120/contents/card1/100CANON/_69A8268.CR3"],
          "shootingmodedial": {"value":"m","ability":["m"]},
          "av": {"value":"f5.0","ability":["f1.8","f5.0","f22"]},
          "picturestyle": {"value":"neutral","ability":["standard","neutral"]}
        }
        """#.data(using: .utf8)!
        let response = try JSONDecoder().decode(CCAPIPollingResponse.self, from: json)
        XCTAssertEqual(response.addedcontents, ["/ccapi/ver120/contents/card1/100CANON/_69A8268.CR3"])
        XCTAssertEqual(response.totalContentsCount, 2113)
    }
}
