// ImageAnalysisSharpnessTests.swift
//
// Tier 0: skarphets-klassifiseringen (ren funksjon, uten bilder).

import XCTest
@testable import CaptureApp

final class ImageAnalysisSharpnessTests: XCTestCase {
    func testStatusThresholds() {
        XCTAssertEqual(ImageAnalysis.classifySharpness(energy: 0.0002).status, .soft)
        XCTAssertEqual(ImageAnalysis.classifySharpness(energy: 0.0015).status, .ok)
        XCTAssertEqual(ImageAnalysis.classifySharpness(energy: 0.0050).status, .sharp)
    }

    func testValueClamped() {
        XCTAssertEqual(ImageAnalysis.classifySharpness(energy: 0).value, 0, accuracy: 0.0001)
        XCTAssertLessThanOrEqual(ImageAnalysis.classifySharpness(energy: 999).value, 1.0)
        XCTAssertGreaterThan(ImageAnalysis.classifySharpness(energy: 0.004).value, 0.5)
    }
}
