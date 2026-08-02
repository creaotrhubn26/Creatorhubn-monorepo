import XCTest
import ImageIO
import CoreGraphics
@testable import CaptureApp

/// P1 — captureTime-kjeden: `ExifInfo.captureDate` leser EXIF DateTimeOriginal
/// (ekte opptakstid) fra en fil, som `CameraSession` bruker til å rette
/// `Asset.captureTime` når previewen lander.
final class ExifCaptureDateTests: XCTestCase {

    func testCaptureDateReadsExifDateTimeOriginal() throws {
        let path = try writeJPEG(dateTimeOriginal: "2026:07:15 14:23:45")
        defer { try? FileManager.default.removeItem(atPath: path) }
        let date = try XCTUnwrap(ExifInfo.captureDate(fromPath: path))

        var cal = Calendar(identifier: .gregorian)
        cal.timeZone = .current
        let c = cal.dateComponents([.year, .month, .day, .hour, .minute, .second], from: date)
        XCTAssertEqual(c.year, 2026)
        XCTAssertEqual(c.month, 7)
        XCTAssertEqual(c.day, 15)
        XCTAssertEqual(c.hour, 14)
        XCTAssertEqual(c.minute, 23)
        XCTAssertEqual(c.second, 45)
    }

    func testCaptureDateNilWhenNoExifDate() throws {
        let path = try writeJPEG(dateTimeOriginal: nil)
        defer { try? FileManager.default.removeItem(atPath: path) }
        XCTAssertNil(ExifInfo.captureDate(fromPath: path))
    }

    func testCaptureDateNilForMissingFile() {
        XCTAssertNil(ExifInfo.captureDate(fromPath: "/tmp/does-not-exist-\(UUID()).jpg"))
        XCTAssertNil(ExifInfo.captureDate(fromPath: nil))
    }

    // MARK: - Helper

    /// Skriv en 2×2 JPEG med (valgfri) EXIF DateTimeOriginal.
    private func writeJPEG(dateTimeOriginal: String?) throws -> String {
        let cs = CGColorSpaceCreateDeviceRGB()
        let ctx = try XCTUnwrap(CGContext(
            data: nil, width: 2, height: 2, bitsPerComponent: 8, bytesPerRow: 0,
            space: cs, bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue))
        ctx.setFillColor(CGColor(red: 0.5, green: 0.5, blue: 0.5, alpha: 1))
        ctx.fill(CGRect(x: 0, y: 0, width: 2, height: 2))
        let cg = try XCTUnwrap(ctx.makeImage())

        let url = FileManager.default.temporaryDirectory
            .appendingPathComponent("exif-\(UUID().uuidString).jpg")
        let dest = try XCTUnwrap(CGImageDestinationCreateWithURL(
            url as CFURL, "public.jpeg" as CFString, 1, nil))
        var props: [CFString: Any] = [:]
        if let dto = dateTimeOriginal {
            props[kCGImagePropertyExifDictionary] = [kCGImagePropertyExifDateTimeOriginal: dto]
        }
        CGImageDestinationAddImage(dest, cg, props as CFDictionary)
        XCTAssertTrue(CGImageDestinationFinalize(dest))
        return url.path
    }
}
