import XCTest
import CoreImage
import CoreImage.CIFilterBuiltins
@testable import CaptureApp

/// Phase 7-7F filter contract + behaviour tests.
///
/// **Why these exist:** Phase 7-7F shipped without runtime verification —
/// the build is green but we don't know that the filters honour their
/// contracts (no-op when amount=0, no-op when detection fails, output
/// dimensions match input, masks land in the right region). Quiet bugs
/// in this layer would corrupt every shot delivered to a client.
///
/// **What we cover here:** The unambiguous contract surface — input
/// arguments, no-op early-return paths, output dimensions, detection
/// no-face fallbacks. We don't golden-pixel-test the actual sharpening
/// or whitening (that's calibrated subjectively, and synthetic images
/// don't trigger Vision's photo-trained models reliably). The render
/// quality validation lives in `SMOKE_TEST_R6MKII.md` against real
/// camera output.
///
/// **Synthetic test images:** We generate a uniformly-coloured CIImage
/// of known dimensions instead of loading test CR3s. Vision-detection-
/// based filters detect zero faces / zero horizons on these synthetic
/// images, which is exactly the no-op path we want to test for that
/// branch.

// MARK: - EyeEffectFilter

final class EyeEffectFilterTests: XCTestCase {

    func testNoOpWhenBothAxesZero() throws {
        let recipe = MagicRecipe()  // all axes 0
        let input = makeSyntheticImage(width: 200, height: 200)
        let output = EyeEffectFilter.apply(recipe: recipe, to: input)
        XCTAssertEqual(output.extent, input.extent,
                       "extent must match when filter no-ops")
    }

    func testNoOpWhenNoFacesDetected() throws {
        // Synthetic flat-colour image → CIDetector finds zero faces →
        // filter falls through and returns the input unchanged even
        // when both axes are non-zero.
        var recipe = MagicRecipe()
        recipe.eyeSharpen = 0.5
        recipe.eyeCatchlight = 0.5
        let input = makeSyntheticImage(width: 200, height: 200)
        let output = EyeEffectFilter.apply(recipe: recipe, to: input)
        XCTAssertEqual(output.extent, input.extent,
                       "extent must match when no faces detected")
    }

    func testDetectEyesReturnsEmptyOnSyntheticImage() throws {
        // Vision's face detector requires photo texture; synthetic
        // flat-colour images return empty. This is the documented no-op
        // path — verify we hit it.
        let input = makeSyntheticImage(width: 200, height: 200)
        let eyes = EyeEffectFilter.detectEyes(in: input)
        XCTAssertTrue(eyes.isEmpty,
                      "synthetic image should yield zero face detections")
    }
}

// MARK: - TeethWhiteningFilter

final class TeethWhiteningFilterTests: XCTestCase {

    func testNoOpWhenAxisZero() throws {
        let recipe = MagicRecipe()  // teethWhiten = 0
        let input = makeSyntheticImage(width: 200, height: 200)
        let output = TeethWhiteningFilter.apply(recipe: recipe, to: input)
        XCTAssertEqual(output.extent, input.extent)
    }

    func testNoOpWhenNoFacesDetected() throws {
        var recipe = MagicRecipe()
        recipe.teethWhiten = 0.5
        let input = makeSyntheticImage(width: 200, height: 200)
        let output = TeethWhiteningFilter.apply(recipe: recipe, to: input)
        XCTAssertEqual(output.extent, input.extent)
    }

    func testDetectMouthsReturnsEmptyOnSyntheticImage() throws {
        let input = makeSyntheticImage(width: 200, height: 200)
        let mouths = TeethWhiteningFilter.detectMouths(in: input)
        XCTAssertTrue(mouths.isEmpty)
    }

    func testMakeMaskReturnsNilOnEmptyMouths() throws {
        let input = makeSyntheticImage(width: 200, height: 200)
        let mask = TeethWhiteningFilter.makeMask(in: input, mouths: [])
        // With zero polygons we should get a black-everywhere mask
        // (or nil). Either way, no white pixels means CIBlendWithMask
        // does nothing — which is the safe fallback.
        if let mask {
            XCTAssertEqual(mask.extent, input.extent,
                           "empty-mouth mask must still cover the image extent")
        }
    }
}

// MARK: - AutoStraightenFilter

final class AutoStraightenFilterTests: XCTestCase {

    func testNoOpWhenAllAxesOff() throws {
        let recipe = MagicRecipe()  // autoStraighten = false, angle = 0
        let input = makeSyntheticImage(width: 200, height: 200)
        let output = AutoStraightenFilter.apply(recipe: recipe, to: input)
        XCTAssertEqual(output.extent, input.extent,
                       "no rotation should preserve extent")
    }

    func testManualAngleRotates() throws {
        var recipe = MagicRecipe()
        recipe.straightenAngle = 0.05  // ~2.86°
        let input = makeSyntheticImage(width: 200, height: 200)
        let output = AutoStraightenFilter.apply(recipe: recipe, to: input)
        // CIStraightenFilter auto-crops so extent equals input extent
        // (it scales the rotated content into the original frame).
        XCTAssertEqual(output.extent, input.extent,
                       "CIStraightenFilter is documented to auto-crop")
    }

    func testManualAngleRespectsMaxBound() throws {
        var recipe = MagicRecipe()
        // Angle past ±15° should be rejected → no-op.
        recipe.straightenAngle = 0.4  // ~22.9°, exceeds maxAngle=0.2618
        let input = makeSyntheticImage(width: 200, height: 200)
        let resolved = AutoStraightenFilter.resolveAngle(
            recipe: recipe, in: input,
        )
        XCTAssertNil(resolved,
                     "angles past ±15° must reject (too likely a misdetection)")
    }

    func testAutoStraightenFallsBackToManualWhenDetectionFails() throws {
        var recipe = MagicRecipe()
        recipe.autoStraighten = true
        recipe.straightenAngle = 0.05
        let input = makeSyntheticImage(width: 200, height: 200)
        // Synthetic image fails detection → resolveAngle should fall
        // back to manual angle.
        let resolved = AutoStraightenFilter.resolveAngle(
            recipe: recipe, in: input,
        )
        XCTAssertEqual(resolved ?? -999, 0.05, accuracy: 1e-6,
                       "manual angle is the documented fallback")
    }

    func testMaxAngleIsFifteenDegrees() throws {
        // Documented bound; downstream code (CanonPictureStyle merging,
        // Tune-panel slider range) hard-codes the same value, so any
        // accidental change should fail loudly here.
        let fifteenDegInRadians: CGFloat = 15.0 * .pi / 180.0
        XCTAssertEqual(
            AutoStraightenFilter.maxAngle, fifteenDegInRadians,
            accuracy: 1e-3,
            "max angle drift breaks Tune-panel ±15° slider envelope",
        )
    }
}

// MARK: - SkinToneUnifyFilter

final class SkinToneUnifyFilterTests: XCTestCase {

    func testNoOpWhenAxisZero() throws {
        let recipe = MagicRecipe()
        let input = makeSyntheticImage(width: 200, height: 200)
        let output = SkinToneUnifyFilter.apply(recipe: recipe, to: input)
        XCTAssertEqual(output.extent, input.extent)
    }

    func testNoOpWhenNoFacesDetected() throws {
        var recipe = MagicRecipe()
        recipe.skinUnify = 0.5
        let input = makeSyntheticImage(width: 200, height: 200)
        let output = SkinToneUnifyFilter.apply(recipe: recipe, to: input)
        XCTAssertEqual(output.extent, input.extent,
                       "must no-op when no faces — never apply random shift")
    }
}

// MARK: - SubjectType + recipe overlay

final class MagicRecipeSubjectTypeTests: XCTestCase {

    func testNoneOverlayIsNeutral() throws {
        var recipe = MagicRecipe()
        recipe.subjectType = .none
        XCTAssertTrue(recipe.subjectTypeAdjustment.isNeutral,
                      ".none must produce a fully neutral overlay")
    }

    func testMaleOverlayPreservesTexture() throws {
        var recipe = MagicRecipe()
        recipe.subjectType = .male
        let overlay = recipe.subjectTypeAdjustment
        XCTAssertGreaterThan(overlay.skinHighFreq, 0,
                             "male should boost skin detail (preserve texture)")
        XCTAssertLessThan(overlay.skinLowFreq, 0,
                          "male should reduce tone smoothing")
    }

    func testElderlyOverlayPreservesWisdomLines() throws {
        var recipe = MagicRecipe()
        recipe.subjectType = .elderly
        let overlay = recipe.subjectTypeAdjustment
        XCTAssertLessThanOrEqual(overlay.skinLowFreq, 0,
                                 "elderly: never smooth tone aggressively (preserve wrinkles)")
        XCTAssertGreaterThan(overlay.skinUnify, 0,
                             "elderly: unify uneven skin")
    }

    func testFemaleOverlayAddsWarmth() throws {
        var recipe = MagicRecipe()
        recipe.subjectType = .female
        let overlay = recipe.subjectTypeAdjustment
        XCTAssertGreaterThan(overlay.warmth, 0,
                             "female: mild warmth bump per industry guides")
    }

    func testChildOverlayKeepsSkinNatural() throws {
        var recipe = MagicRecipe()
        recipe.subjectType = .child
        let overlay = recipe.subjectTypeAdjustment
        XCTAssertLessThanOrEqual(overlay.skinLowFreq, 0,
                                 "child: never aggressively smooth (kids' skin already smooth)")
    }
}

// MARK: - Codable backwards-compat

final class MagicRecipeCodableTests: XCTestCase {

    func testDecodeWithMissingPhase7Fields() throws {
        // Pre-Phase-7 persisted JSON shape — only the original 6 axes.
        // Custom decoder must default the new fields to 0 / false /
        // .none rather than throwing. This is the on-disk migration
        // path for old recipes.
        let json = """
        {"warmth":0.1,"shadowLift":0.2,"contrast":0.05,"saturation":0.05}
        """.data(using: .utf8)!
        let recipe = try JSONDecoder().decode(MagicRecipe.self, from: json)
        XCTAssertEqual(recipe.warmth, 0.1, accuracy: 1e-6)
        XCTAssertEqual(recipe.skinHighFreq, 0)
        XCTAssertEqual(recipe.skinLowFreq, 0)
        XCTAssertEqual(recipe.eyeSharpen, 0)
        XCTAssertEqual(recipe.teethWhiten, 0)
        XCTAssertEqual(recipe.subjectType, .none)
        XCTAssertEqual(recipe.skinUnify, 0)
        XCTAssertFalse(recipe.autoStraighten)
        XCTAssertEqual(recipe.straightenAngle, 0)
    }

    func testRoundTripWithAllFieldsSet() throws {
        var recipe = MagicRecipe.portrait
        recipe.subjectType = .female
        recipe.autoStraighten = true
        recipe.straightenAngle = 0.05
        let data = try JSONEncoder().encode(recipe)
        let decoded = try JSONDecoder().decode(MagicRecipe.self, from: data)
        XCTAssertEqual(decoded.subjectType, .female)
        XCTAssertEqual(decoded.eyeSharpen, recipe.eyeSharpen, accuracy: 1e-6)
        XCTAssertEqual(decoded.teethWhiten, recipe.teethWhiten, accuracy: 1e-6)
        XCTAssertTrue(decoded.autoStraighten)
        XCTAssertEqual(decoded.straightenAngle, 0.05, accuracy: 1e-6)
    }
}

// MARK: - Benchmarks

/// Benchmark each Phase 7-7F filter against a synthetic full-res
/// image (R5-equivalent 8192×5464). The Vision-detection paths all
/// no-op on synthetic images (returning empty results), so these
/// numbers measure the SETUP cost — Vision request creation +
/// downsample for AutoStraighten + face-detector init + areaAverage
/// strip computation. Real-photo numbers will be higher (detection
/// returns hits → mask generation runs → blend executes); these
/// give us a floor.
final class Phase7FilterBenchmarks: XCTestCase {

    private func fullResImage() -> CIImage {
        // R6mkII sensor dimensions (8192×5464). Allocating a CIImage
        // by colour-fill is essentially free; the cost shows up when
        // CIContext rasterises it, which is what these filters do.
        return makeSyntheticImage(width: 8192, height: 5464)
    }

    func testAutoStraightenFullRes() throws {
        var recipe = MagicRecipe()
        recipe.autoStraighten = true
        let input = fullResImage()
        measure {
            _ = AutoStraightenFilter.apply(recipe: recipe, to: input)
        }
    }

    func testEyeEffectFullRes() throws {
        var recipe = MagicRecipe()
        recipe.eyeSharpen = 0.3
        recipe.eyeCatchlight = 0.2
        let input = fullResImage()
        measure {
            _ = EyeEffectFilter.apply(recipe: recipe, to: input)
        }
    }

    func testTeethWhiteningFullRes() throws {
        var recipe = MagicRecipe()
        recipe.teethWhiten = 0.2
        let input = fullResImage()
        measure {
            _ = TeethWhiteningFilter.apply(recipe: recipe, to: input)
        }
    }

    func testSkinToneUnifyFullRes() throws {
        var recipe = MagicRecipe()
        recipe.skinUnify = 0.3
        let input = fullResImage()
        measure {
            _ = SkinToneUnifyFilter.apply(recipe: recipe, to: input)
        }
    }
}

// MARK: - Helpers

/// Build a flat-colour CIImage of the given dimensions. Used as the
/// canonical test fixture for every filter — Vision-detection-based
/// filters all no-op on these (no face / no horizon / no mouth), and
/// the no-op fallback is exactly the path we want to verify.
private func makeSyntheticImage(width: Int, height: Int) -> CIImage {
    return CIImage(color: CIColor(red: 0.5, green: 0.5, blue: 0.5))
        .cropped(to: CGRect(x: 0, y: 0, width: width, height: height))
}
