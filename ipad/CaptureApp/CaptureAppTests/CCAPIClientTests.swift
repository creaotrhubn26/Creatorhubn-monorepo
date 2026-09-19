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

    /// P3 (E2): eksponeringskompensasjon dekodes fra `exposure`-diffen (samme
    /// value-mønster som av/tv/iso).
    func testPollingResponseDecodesExposureCompensation() throws {
        let json = #"""
        {
          "av": {"value":"f2.8"},
          "tv": {"value":"1/125"},
          "iso": {"value":"800"},
          "exposure": {"value":"+0.3","ability":["-3","0","+0.3","+3"]}
        }
        """#.data(using: .utf8)!
        let response = try JSONDecoder().decode(CCAPIPollingResponse.self, from: json)
        XCTAssertEqual(response.apertureValue, "f2.8")
        XCTAssertEqual(response.isoValue, "800")
        XCTAssertEqual(response.exposureCompensation, "+0.3")
    }

    func testPollingResponseDecodesMovieRecordingState() throws {
        let start = try JSONDecoder().decode(
            CCAPIPollingResponse.self,
            from: Data(#"{"recbutton":{"action":"start"}}"#.utf8)
        )
        let stop = try JSONDecoder().decode(
            CCAPIPollingResponse.self,
            from: Data(#"{"recbutton":{"status":"stop"}}"#.utf8)
        )
        XCTAssertEqual(start.movieRecording, true)
        XCTAssertEqual(stop.movieRecording, false)
    }

    func testPollingResponseAndBatteryPresentationHandlePercentAndNamedLevels() throws {
        let response = try JSONDecoder().decode(
            CCAPIPollingResponse.self,
            from: Data(#"{"battery":{"level":"17"}}"#.utf8)
        )
        XCTAssertEqual(response.batteryLevel, "17")

        let numeric = try XCTUnwrap(CCAPIBatteryStatus(rawValue: "17%"))
        XCTAssertEqual(numeric.percent, 17)
        XCTAssertEqual(numeric.label, "17%")
        XCTAssertEqual(numeric.systemImage, "battery.25")
        XCTAssertTrue(numeric.isLow)

        let named = try XCTUnwrap(CCAPIBatteryStatus(rawValue: "full"))
        XCTAssertEqual(named.label, "Full")
        XCTAssertEqual(named.systemImage, "battery.100")
        XCTAssertFalse(named.isLow)

        let realR6Level = try XCTUnwrap(CCAPIBatteryStatus(rawValue: "high"))
        XCTAssertEqual(realR6Level.label, "Høy")
        XCTAssertEqual(realR6Level.systemImage, "battery.75")
        XCTAssertFalse(realR6Level.isLow)

        let quarter = try XCTUnwrap(CCAPIBatteryStatus(rawValue: "quarter"))
        XCTAssertEqual(quarter.label, "Kvart")
        XCTAssertTrue(quarter.isLow)
    }

    @MainActor
    func testManualCameraAddressNormalizesDisplayedCCAPIURLAndCustomPort() throws {
        XCTAssertEqual(
            CCAPILiveViewController.normalizedCameraURL("192.168.1.42:8080")?.absoluteString,
            "http://192.168.1.42:8080"
        )
        XCTAssertEqual(
            CCAPILiveViewController.normalizedCameraURL("https://192.168.1.42:9443/ccapi")?.absoluteString,
            "https://192.168.1.42:9443"
        )
        XCTAssertNil(CCAPILiveViewController.normalizedCameraURL("ftp://192.168.1.42"))
        XCTAssertNil(CCAPILiveViewController.normalizedCameraURL(""))
    }

    @MainActor
    func testDiscoveryProbesPlainHTTPDefaultAndKnownCanonPorts() {
        let variants = CameraDiscovery.probeVariants.map {
            "\($0.scheme):\($0.port ?? ($0.scheme == "https" ? 443 : 80))"
        }
        XCTAssertTrue(variants.contains("http:80"))
        XCTAssertTrue(variants.contains("http:8080"))
        XCTAssertTrue(variants.contains("https:443"))
        XCTAssertTrue(variants.contains("https:8443"))
    }
}
