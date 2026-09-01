import Foundation
import XCTest
@testable import StoryboardStudio

final class StampTextureCacheIdentityTests: XCTestCase {
    func testPoseLeanChangeInvalidatesProductionTextureKey() throws {
        let original = makeStamp(parameters: ["poseLean": "0", "emotion": "calm"])
        let changed = makeStamp(parameters: ["poseLean": "0.55", "emotion": "calm"])

        let originalKey = try StampTextureCacheIdentity.productionKey(
            preset: .characterPoseStamp, stamp: original)
        let changedKey = try StampTextureCacheIdentity.productionKey(
            preset: .characterPoseStamp, stamp: changed)

        XCTAssertNotEqual(originalKey, changedKey)
    }

    func testIdenticalContentReusesKeyIndependentOfDictionaryInsertionOrder() throws {
        var firstParameters: [String: String] = [:]
        firstParameters["poseLean"] = "0.25"
        firstParameters["emotion"] = "focused"
        var secondParameters: [String: String] = [:]
        secondParameters["emotion"] = "focused"
        secondParameters["poseLean"] = "0.25"

        let first = makeStamp(parameters: firstParameters)
        let second = makeStamp(parameters: secondParameters)
        let firstKey = try StampTextureCacheIdentity.productionKey(
            preset: .characterPoseStamp, stamp: first)
        let secondKey = try StampTextureCacheIdentity.productionKey(
            preset: .characterPoseStamp, stamp: second)
        var cache = [String: String]()
        cache[firstKey] = "cached-texture"

        XCTAssertEqual(firstKey, secondKey)
        XCTAssertEqual(cache[secondKey], "cached-texture")
    }

    func testGeometryContentChangeInvalidatesProductionTextureKey() throws {
        let original = makeStamp(parameters: ["poseLean": "0.25"])
        var changed = original
        changed.compoundGeometry?.paths[0].points[1].x += 0.5

        XCTAssertNotEqual(
            try StampTextureCacheIdentity.productionKey(
                preset: .characterPoseStamp, stamp: original),
            try StampTextureCacheIdentity.productionKey(
                preset: .characterPoseStamp, stamp: changed)
        )
    }

    func testCustomTipUsesStableSHA256ContentIdentity() {
        XCTAssertEqual(
            StampTextureCacheIdentity.customTipKey(for: Data("abc".utf8)),
            "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad"
        )
    }

    private func makeStamp(parameters: [String: String]) -> ProductionStampInstance {
        ProductionStampInstance(
            variant: 1,
            variantName: "Running",
            seed: 42,
            depth: .midground,
            styleProfileId: "trr-story-pencil",
            parameters: parameters,
            compoundGeometry: ProductionStampCompoundGeometry(paths: [
                ProductionStampVectorPath(
                    id: "contour-1",
                    role: .contour,
                    points: [
                        ProductionStampVectorPoint(x: 12, y: 18),
                        ProductionStampVectorPoint(x: 84, y: 96),
                    ],
                    closed: false,
                    lineWidth: 1.5,
                    opacity: 0.9
                ),
            ]),
            perspectiveSkew: 0.1
        )
    }
}
