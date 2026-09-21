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

    func testChoiceSettingDecodesNumericValueAndRangeAbility() throws {
        let data = Data(#"{"value":5600,"ability":{"min":2500,"max":10000,"step":100}}"#.utf8)
        let setting = try JSONDecoder().decode(CCAPIChoiceSetting.self, from: data)
        XCTAssertEqual(setting.value, "5600")
        XCTAssertEqual(setting.ability.first, "2500")
        XCTAssertEqual(setting.ability.last, "10000")
        XCTAssertEqual(setting.ability.count, 76)
    }

    func testMediaTransferProgressCalculatesPercentAndRemainingTime() {
        let progress = CCAPIMediaTransferProgress(
            receivedBytes: 25_000_000,
            totalBytes: 100_000_000,
            elapsedSeconds: 5
        )

        XCTAssertEqual(progress.fractionCompleted, 0.25)
        XCTAssertEqual(progress.percentCompleted, 25)
        XCTAssertEqual(progress.estimatedRemainingSeconds, 15)
    }

    func testFlipDetailGeometryParsesAndMapsTouchCoordinates() throws {
        let json = Data(#"{"liveviewdata":{"image":{"positionx":0,"positiony":312,"positionwidth":6000,"positionheight":3375,"sizex":6000,"sizey":3999},"visible":{"positionx":0,"positiony":313,"positionwidth":6000,"positionheight":3375}}}"#.utf8)
        let length = UInt32(json.count)
        var packet = Data([
            0xff, 0x00, 0x01,
            UInt8((length >> 24) & 0xff),
            UInt8((length >> 16) & 0xff),
            UInt8((length >> 8) & 0xff),
            UInt8(length & 0xff),
        ])
        packet.append(json)
        packet.append(contentsOf: [0xff, 0xff, 0xff, 0x00, 0x00, 0x00, 0x00, 0x02, 0xff, 0xd8])

        let geometry = try CCAPIClient.parseLiveViewGeometry(packet)
        XCTAssertEqual(geometry.imageWidth, 6000)
        XCTAssertEqual(geometry.imageHeight, 3999)
        XCTAssertEqual(geometry.cameraPosition(normalizedX: 0.5, normalizedY: 0.5).x, 3000)
        XCTAssertEqual(geometry.cameraPosition(normalizedX: 0.5, normalizedY: 0.5).y, 2001)
        XCTAssertEqual(geometry.cameraPosition(normalizedX: -1, normalizedY: 2).x, 0)
        XCTAssertEqual(geometry.cameraPosition(normalizedX: -1, normalizedY: 2).y, 3688)
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

    @MainActor
    func testLiveViewControllerQueuesUniqueMoviesFromCameraEvents() {
        let controller = CCAPILiveViewController()
        let movie = "/ccapi/ver120/contents/sd/100CANON/MVI_0042.MP4"
        controller.applyTelemetry(CCAPIPollingResponse(addedcontents: [
            movie,
            "/ccapi/ver120/contents/sd/100CANON/IMG_0042.JPG",
        ]))
        controller.applyTelemetry(CCAPIPollingResponse(addedcontents: [movie]))

        XCTAssertEqual(controller.pendingMovieImportCount, 1)
    }

    func testTransferConfirmationSeparatesLocalStorageFromVerifiedCreatorHubUpload() {
        let local = VideoTransferConfirmation(
            fileName: "MVI_0042.MP4",
            stage: .storedLocally
        )
        XCTAssertEqual(local.title, "Lagret på iPaden")
        XCTAssertTrue(local.detail.contains("opplasting fortsetter i bakgrunnen"))

        let localOnly = VideoTransferConfirmation(
            fileName: "MVI_0042.MP4",
            stage: .storedLocallyOnly
        )
        XCTAssertEqual(localOnly.title, "Lagret på iPaden")
        XCTAssertTrue(localOnly.detail.contains("kun lokalt"))

        let remote = VideoTransferConfirmation(
            fileName: "MVI_0042.MP4",
            stage: .securedInCreatorHub
        )
        XCTAssertEqual(remote.title, "Sikret i CreatorHub")
        XCTAssertTrue(remote.detail.contains("lastet opp og verifisert"))
    }
}
