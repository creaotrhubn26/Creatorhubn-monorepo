import XCTest
@testable import StoryboardStudio

final class FrameRenderMemoryPolicyTests: XCTestCase {
    private let gibibyte = UInt64(1_024 * 1_024 * 1_024)

    func testAdaptiveDeviceTiersAreDeterministicAtBoundaries() {
        let low = FrameRenderMemoryPolicy.adaptive(
            physicalMemoryBytes: 4 * gibibyte)
        let medium = FrameRenderMemoryPolicy.adaptive(
            physicalMemoryBytes: 4 * gibibyte + 1)
        let high = FrameRenderMemoryPolicy.adaptive(
            physicalMemoryBytes: 8 * gibibyte + 1)

        XCTAssertEqual(low.maximumTextureDimension, 4_096)
        XCTAssertEqual(low.maximumSourcePixelCount, 8_000_000)
        XCTAssertEqual(medium.maximumTextureDimension, 6_144)
        XCTAssertEqual(medium.maximumSourcePixelCount, 12_000_000)
        XCTAssertEqual(high.maximumTextureDimension, 8_192)
        XCTAssertEqual(high.maximumSourcePixelCount, 16_000_000)
    }

    func testSourceRenderSizeHonorsDimensionAndPixelBudgets() throws {
        let policy = FrameRenderMemoryPolicy.adaptive(
            physicalMemoryBytes: 16 * gibibyte)
        let size = try XCTUnwrap(policy.sourceRenderSize(
            sourceWidth: 8_192,
            sourceHeight: 8_192,
            requiredScale: 1
        ))

        XCTAssertLessThanOrEqual(size.width, policy.maximumTextureDimension)
        XCTAssertLessThanOrEqual(size.height, policy.maximumTextureDimension)
        XCTAssertLessThanOrEqual(
            size.width * size.height,
            policy.maximumSourcePixelCount
        )
    }

    func testReadbackKeepsNormalDeliverySizeAndBoundsExtremeAspect() throws {
        let policy = FrameRenderMemoryPolicy.adaptive(
            physicalMemoryBytes: 16 * gibibyte)
        let fullHD = try XCTUnwrap(policy.readbackSize(
            sourceWidth: 8_192,
            sourceHeight: 4_608,
            maximumWidth: 1_920,
            aspectRatio: 16.0 / 9.0
        ))
        XCTAssertEqual(fullHD, ShotFramingSize(width: 1_920, height: 1_080))

        let extremePortrait = try XCTUnwrap(policy.readbackSize(
            sourceWidth: 8_192,
            sourceHeight: 8_192,
            maximumWidth: 8_192,
            aspectRatio: 0.1
        ))
        XCTAssertLessThanOrEqual(
            extremePortrait.width * extremePortrait.height,
            policy.maximumReadbackPixelCount
        )
        XCTAssertLessThanOrEqual(
            max(extremePortrait.width, extremePortrait.height),
            policy.maximumTextureDimension
        )
    }

    func testInvalidGeometryFailsClosed() {
        let policy = FrameRenderMemoryPolicy.adaptive(
            physicalMemoryBytes: 4 * gibibyte)
        XCTAssertNil(policy.sourceRenderSize(
            sourceWidth: .infinity,
            sourceHeight: 1_080,
            requiredScale: 1
        ))
        XCTAssertNil(policy.readbackSize(
            sourceWidth: 1_920,
            sourceHeight: 1_080,
            maximumWidth: .nan,
            aspectRatio: 16.0 / 9.0
        ))
    }
}
