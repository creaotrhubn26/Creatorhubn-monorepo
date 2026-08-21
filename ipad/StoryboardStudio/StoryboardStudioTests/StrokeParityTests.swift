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
}
