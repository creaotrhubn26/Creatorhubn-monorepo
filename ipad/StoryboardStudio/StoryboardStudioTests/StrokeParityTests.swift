import XCTest
@testable import StoryboardStudio

final class StrokeParityTests: XCTestCase {
    func testWebJSONRoundtrip() throws {
        let stroke = PencilStroke(
            id: "ipad-123",
            points: [
                StrokePoint(x: 10, y: 20, pressure: 0.7, tiltX: 30, tiltY: 10, timestamp: 1000),
                StrokePoint(x: 15, y: 25, pressure: 0.9, tiltX: 28, tiltY: 12, timestamp: 1009),
            ],
            inputType: "pencil",
            color: "#26282e",
            width: 6,
            opacity: 0.95,
            brush: BrushSpec.preset(.charcoal, size: 6, color: "#26282e", opacity: 0.95))

        let json = try StrokeSerialization.encodeToWebJSON([stroke])
        let decoded = try StrokeSerialization.decodeFromWebJSON(json)
        XCTAssertEqual(decoded, [stroke])
        // Web-parseren (parseStoredStrokes) krever felter med disse navnene:
        XCTAssertTrue(json.contains("\"pressure\""))
        XCTAssertTrue(json.contains("\"tiltX\""))
        XCTAssertTrue(json.contains("\"brush\""))
        XCTAssertTrue(json.contains("\"charcoal\""))
    }

    func testSeededRandomDeterministic() {
        var a = SeededRandom(seedKey: "stroke-abc")
        var b = SeededRandom(seedKey: "stroke-abc")
        for _ in 0..<50 {
            XCTAssertEqual(a.next(), b.next())
        }
        var c = SeededRandom(seedKey: "stroke-xyz")
        XCTAssertNotEqual(a.next(), c.next())
    }

    func testStreamlineAmountsMatchWeb() {
        // Web-paritet: STREAMLINE_BY_TYPE i PencilCanvasPro.tsx
        XCTAssertEqual(Streamline.amount(for: .pen), 0.45)
        XCTAssertEqual(Streamline.amount(for: .ink), 0.5)
        XCTAssertEqual(Streamline.amount(for: .marker), 0.3)
        XCTAssertEqual(Streamline.amount(for: .pencil), 0.2)
        XCTAssertEqual(Streamline.amount(for: .eraser), 0.15)
    }

    func testEraserHasStampConfig() {
        XCTAssertNotNil(StampConfig.forBrush(.eraser))
        XCTAssertNil(StampConfig.forBrush(.smudge))
    }

    func testPaperToothStableAndBounded() {
        let first = PaperTooth.sample(12.3, 45.6)
        let second = PaperTooth.sample(12.3, 45.6)
        XCTAssertEqual(first, second)
        for i in 0..<100 {
            let value = PaperTooth.sample(Double(i) * 0.37, Double(i) * 0.91)
            XCTAssertGreaterThanOrEqual(value, 0)
            XCTAssertLessThanOrEqual(value, 1)
        }
    }

    // Board Pro-felter: boardLayer + textAnnotation må overleve rundtur,
    // og utelates i JSON når nil (eldre web-parsere skal ikke se dem).
    func testBoardLayerAndTextAnnotationRoundtrip() throws {
        var stroke = PencilStroke(
            id: "board-1", points: [StrokePoint(x: 1, y: 2, pressure: 0.85, tiltX: 0, tiltY: 0, timestamp: 1)],
            inputType: "pencil", color: "#8b5cf6", width: 7, opacity: 0.95,
            brush: BrushSpec.preset(.ink, size: 7, color: "#8b5cf6", opacity: 0.95))
        stroke.boardLayer = "Camera / Arrows"
        stroke.textAnnotation = "PUSH IN"
        let json = try StrokeSerialization.encodeToWebJSON([stroke])
        let decoded = try StrokeSerialization.decodeFromWebJSON(json)
        XCTAssertEqual(decoded.first?.boardLayer, "Camera / Arrows")
        XCTAssertEqual(decoded.first?.textAnnotation, "PUSH IN")

        let plain = PencilStroke(
            id: "p", points: stroke.points, inputType: "pencil",
            color: "#000000", width: 3, opacity: 1, brush: nil)
        let plainJSON = try StrokeSerialization.encodeToWebJSON([plain])
        XCTAssertFalse(plainJSON.contains("boardLayer"))
        XCTAssertFalse(plainJSON.contains("textAnnotation"))
    }

    // Tolerant decode: web lagrer brush uten pressureSensitivity m.fl. —
    // strict decode blanket hele framen (regresjonsvern for prod-buggen).
    func testTolerantDecodeMissingBrushFields() throws {
        let json = """
        [{"id":"web-1","inputType":"pencil","color":"#26282e","width":6,"opacity":0.95,
          "points":[{"x":10,"y":20}],
          "brush":{"type":"charcoal","size":6,"color":"#26282e","opacity":0.95,
                   "hardness":0.25,"flow":0.85,"wetness":0,"grain":0.85,"tiltSensitivity":0.55}}]
        """
        let decoded = try StrokeSerialization.decodeFromWebJSON(json)
        XCTAssertEqual(decoded.count, 1)
        XCTAssertEqual(decoded.first?.brush?.pressureSensitivity, 0.85)
        XCTAssertEqual(decoded.first?.points.first?.pressure, 0.5)
        XCTAssertEqual(decoded.first?.points.first?.tiltX, 0)
    }

    func testTolerantDecodeUnknownBrushType() throws {
        let json = """
        [{"id":"web-2","inputType":"pencil","color":"#000","width":4,"opacity":1,
          "points":[{"x":1,"y":2,"pressure":0.5,"tiltX":0,"tiltY":0,"timestamp":0}],
          "brush":{"type":"airbrush-fancy","size":4,"color":"#000","opacity":1}}]
        """
        let decoded = try StrokeSerialization.decodeFromWebJSON(json)
        XCTAssertEqual(decoded.first?.brush?.type, .pencil)
    }
}
