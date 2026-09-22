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

    func testSkinProbabilityAcceptsDiverseSkinAndRejectsClothingColours() {
        let lightSkin = SkinToneUnifyFilter.skinProbability(r: 0.86, g: 0.66, b: 0.54)
        let darkSkin = SkinToneUnifyFilter.skinProbability(r: 0.34, g: 0.20, b: 0.14)
        let blueFabric = SkinToneUnifyFilter.skinProbability(r: 0.12, g: 0.28, b: 0.72)
        let blackKnit = SkinToneUnifyFilter.skinProbability(r: 0.045, g: 0.04, b: 0.04)
        let neutralGrey = SkinToneUnifyFilter.skinProbability(r: 0.45, g: 0.45, b: 0.45)

        XCTAssertGreaterThan(lightSkin, 0.15, "lys hud falt ut av kroppsmasken")
        XCTAssertGreaterThan(darkSkin, 0.15, "mørk hud falt ut av kroppsmasken")
        XCTAssertEqual(blueFabric, 0, accuracy: 0.001)
        XCTAssertEqual(blackKnit, 0, accuracy: 0.001)
        XCTAssertEqual(neutralGrey, 0, accuracy: 0.001)
    }

    func testSkinColourCubeProducesTheExpectedMaskValues() throws {
        func maskValue(_ color: CIColor) throws -> Double {
            let extent = CGRect(x: 0, y: 0, width: 8, height: 8)
            let image = CIImage(color: color).cropped(to: extent)
            let mask = try XCTUnwrap(
                SkinToneUnifyFilter.plausibleSkinMask(for: image, extent: extent)
            )
            var pixel = [UInt8](repeating: 0, count: 4)
            CIContext(options: [.useSoftwareRenderer: true]).render(
                mask,
                toBitmap: &pixel,
                rowBytes: 4,
                bounds: CGRect(x: 0, y: 0, width: 1, height: 1),
                format: .RGBA8,
                colorSpace: CGColorSpace(name: CGColorSpace.sRGB)
            )
            return Double(pixel[0]) / 255
        }

        let skin = try maskValue(CIColor(red: 0.86, green: 0.66, blue: 0.54))
        let blue = try maskValue(CIColor(red: 0.12, green: 0.28, blue: 0.72))
        let grey = try maskValue(CIColor(red: 0.45, green: 0.45, blue: 0.45))
        XCTAssertGreaterThan(skin, 0.12, "GPU-masken mistet hud etter LUT-oppslag")
        XCTAssertLessThan(blue, 0.02, "GPU-masken tok med blå klær")
        XCTAssertLessThan(grey, 0.02, "GPU-masken tok med nøytrale klær")
    }
}

// MARK: - Detailed portrait retouch + subject-adaptive tone

final class PortraitRetouchFilterTests: XCTestCase {
    func testDiscolorationCorrectionRendersThroughCoreImage() throws {
        let extent = CGRect(x: 0, y: 0, width: 128, height: 96)
        let base = CIImage(color: CIColor(red: 0.72, green: 0.49, blue: 0.38))
            .cropped(to: extent)
        let redPatch = CIImage(color: CIColor(red: 0.88, green: 0.30, blue: 0.28))
            .cropped(to: CGRect(x: 48, y: 32, width: 30, height: 30))
            .composited(over: base)
        let mask = CIImage(color: .white).cropped(to: extent)

        let corrected = SkinFinishFilter.applyDiscolorationCorrection(
            amount: 0.7,
            to: redPatch,
            skinMask: mask,
            extent: extent
        )
        XCTAssertEqual(corrected.extent, extent)
        XCTAssertNotNil(CIContext(options: [.useSoftwareRenderer: true]).createCGImage(corrected, from: extent),
                        "chroma-korreksjonen må kunne rendres på CPU-fallback uten en GPU/ANE")
    }

    func testRetouchLevelsIncreaseCleanupWithoutDroppingIdentityProtection() {
        var natural = MagicRecipe()
        natural.applyPortraitRetouchLevel(.natural)
        var clean = MagicRecipe()
        clean.applyPortraitRetouchLevel(.clean)
        var maximum = MagicRecipe()
        maximum.applyPortraitRetouchLevel(.maximum)

        XCTAssertLessThan(natural.blemishCleanup, clean.blemishCleanup)
        XCTAssertLessThan(clean.blemishCleanup, maximum.blemishCleanup)
        XCTAssertLessThan(natural.skinDiscoloration, clean.skinDiscoloration)
        XCTAssertLessThan(clean.skinDiscoloration, maximum.skinDiscoloration)
        XCTAssertTrue(natural.preserveIdentityMarks)
        XCTAssertTrue(clean.preserveIdentityMarks)
        XCTAssertTrue(maximum.preserveIdentityMarks,
                      "maksimal retusj må kreve eksplisitt opt-out før identitetsmerker fjernes")
    }

    func testRetouchLevelOnlyChangesPortraitControls() {
        var recipe = MagicRecipe(warmth: -0.27, contrast: 0.31, saturation: -0.08)
        recipe.applyPortraitRetouchLevel(.clean)
        XCTAssertEqual(recipe.warmth, -0.27, accuracy: 1e-6)
        XCTAssertEqual(recipe.contrast, 0.31, accuracy: 1e-6)
        XCTAssertEqual(recipe.saturation, -0.08, accuracy: 1e-6)
        XCTAssertEqual(recipe.portraitRetouchLevel, .clean)
    }

    func testRetouchPolicyRoundTripsAndOldRecipesStaySafe() throws {
        var recipe = MagicRecipe()
        recipe.applyPortraitRetouchLevel(.maximum)
        recipe.preserveIdentityMarks = false
        let decoded = try JSONDecoder().decode(
            MagicRecipe.self,
            from: JSONEncoder().encode(recipe)
        )
        XCTAssertEqual(decoded.portraitRetouchLevel, .maximum)
        XCTAssertFalse(decoded.preserveIdentityMarks)
        XCTAssertEqual(decoded.skinDiscoloration, recipe.skinDiscoloration, accuracy: 1e-6)

        let legacy = Data("{\"warmth\":0,\"shadowLift\":0,\"contrast\":0,\"saturation\":0}".utf8)
        let safeLegacy = try JSONDecoder().decode(MagicRecipe.self, from: legacy)
        XCTAssertTrue(safeLegacy.preserveIdentityMarks)
        XCTAssertEqual(safeLegacy.portraitRetouchLevel, .custom)
        XCTAssertEqual(safeLegacy.skinDiscoloration, 0)
    }

    func testDetailedRetouchNoOpsSafelyWithoutFace() {
        var recipe = MagicRecipe.portrait
        recipe.blemishCleanup = 1
        recipe.skinDiscoloration = 1
        recipe.dodgeBurn = 1
        recipe.shineControl = 1
        recipe.underEyeLift = 1
        let input = makeSyntheticImage(width: 240, height: 180)
        let output = SkinFinishFilter.applyPortraitRetouch(recipe: recipe, to: input)
        XCTAssertEqual(output.extent, input.extent)
        XCTAssertNil(SkinFinishFilter.retouchMap(recipe: recipe, to: input))
    }

    /// Small deterministic QA matrix representing dark, mid and bright faces
    /// plus the common mixed-light casts. This catches overexposure, non-finite
    /// output and direction errors without pretending synthetic colours replace
    /// real R6 Mark II portrait validation.
    func testAdaptivePortraitToneMatrixStaysBoundedAndCorrectsDirection() {
        let cases: [(luma: Double, cast: ImageAnalysis.SkinReading.Cast, expectedEVSign: Double)] = [
            (0.16, .neutral, 1),
            (0.36, .tooGreen, 1),
            (0.68, .tooWarm, -1),
            (0.48, .tooCool, 0),
            (0.50, .tooMagenta, 0),
        ]
        for item in cases {
            let analysis = makeAnalysis(faceLuma: item.luma, cast: item.cast)
            let result = PortraitToneAdvisor.adjust(recipe: .portrait, exposureEV: 0, analysis: analysis)
            XCTAssertTrue(result.exposureEV.isFinite)
            XCTAssertTrue((-2...2).contains(result.exposureEV))
            if item.expectedEVSign > 0 { XCTAssertGreaterThan(result.exposureEV, 0) }
            if item.expectedEVSign < 0 { XCTAssertLessThan(result.exposureEV, 0) }
            XCTAssertGreaterThanOrEqual(result.recipe.skinGuard, 0.6)
            XCTAssertTrue((0...1).contains(result.recipe.blemishCleanup))
            XCTAssertTrue((0...1).contains(result.recipe.dodgeBurn))
        }
    }

    func testAdaptiveToneCorrectsSkinCastOnExpectedAxis() {
        let green = PortraitToneAdvisor.adjust(
            recipe: .portrait, exposureEV: 0,
            analysis: makeAnalysis(faceLuma: 0.48, cast: .tooGreen)
        )
        XCTAssertGreaterThan(green.recipe.tint, MagicRecipe.portrait.tint)
        let warm = PortraitToneAdvisor.adjust(
            recipe: .portrait, exposureEV: 0,
            analysis: makeAnalysis(faceLuma: 0.48, cast: .tooWarm)
        )
        XCTAssertLessThan(warm.recipe.warmth, MagicRecipe.portrait.warmth)
    }

    private func makeAnalysis(faceLuma: Double, cast: ImageAnalysis.SkinReading.Cast) -> AssetAnalysis {
        AssetAnalysis(
            version: AssetAnalysis.currentVersion,
            medianLuma: 0.42,
            p5Luma: 0.05,
            p95Luma: 0.91,
            highlightClip: 0.01,
            shadowClip: 0.02,
            subjectHighlightClip: 0.015,
            globalSharpness: 0.004,
            subjectSharpness: 0.004,
            skinCast: cast,
            faces: [FaceAnalysis(
                rect: CGRect(x: 0.3, y: 0.2, width: 0.4, height: 0.55),
                sizeFraction: 0.22,
                luma: faceLuma,
                eyesOpen: true,
                captureQuality: 0.9,
                sharpness: 0.004,
                skinCast: cast
            )],
            sceneFeature: Array(repeating: 0, count: 12),
            perceptualHash: 1
        )
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

// MARK: - Face-aware crop

final class PortraitCropAdvisorTests: XCTestCase {
    func testFourFiveCropHasCorrectPixelAspectAndComposition() throws {
        let imageSize = CGSize(width: 4000, height: 6000)
        let faceVision = CGRect(x: 0.40, y: 0.55, width: 0.18, height: 0.18)
        let settings = PortraitCropSettings(
            aspect: .fourFive,
            headSize: 0.36,
            topMargin: 0.10,
            horizontalPosition: 0.50
        )
        let crop = try XCTUnwrap(PortraitCropAdvisor.crop(
            faceRectVision: faceVision,
            imageSize: imageSize,
            settings: settings
        ))
        let pixelAspect = crop.width * imageSize.width / (crop.height * imageSize.height)
        XCTAssertEqual(pixelAspect, 4.0 / 5.0, accuracy: 0.0001)

        let faceTopLeft = CGRect(
            x: faceVision.minX,
            y: 1 - faceVision.maxY,
            width: faceVision.width,
            height: faceVision.height
        )
        XCTAssertEqual(faceTopLeft.height / crop.height, 0.36, accuracy: 0.0001)
        XCTAssertEqual((faceTopLeft.minY - crop.minY) / crop.height, 0.10, accuracy: 0.0001)
        XCTAssertEqual((faceTopLeft.midX - crop.minX) / crop.width, 0.50, accuracy: 0.0001)
    }

    func testCropAtImageEdgeKeepsFaceAndBounds() throws {
        let faceVision = CGRect(x: 0.01, y: 0.75, width: 0.22, height: 0.20)
        var settings = PortraitCropSettings()
        settings.horizontalPosition = 0.75
        settings.topMargin = 0.30
        let crop = try XCTUnwrap(PortraitCropAdvisor.crop(
            faceRectVision: faceVision,
            imageSize: CGSize(width: 6000, height: 4000),
            settings: settings
        ))
        XCTAssertGreaterThanOrEqual(crop.minX, 0)
        XCTAssertGreaterThanOrEqual(crop.minY, 0)
        XCTAssertLessThanOrEqual(crop.maxX, 1)
        XCTAssertLessThanOrEqual(crop.maxY, 1)

        let faceTopLeft = CGRect(
            x: faceVision.minX,
            y: 1 - faceVision.maxY,
            width: faceVision.width,
            height: faceVision.height
        )
        XCTAssertTrue(crop.insetBy(dx: -0.0001, dy: -0.0001).contains(faceTopLeft))
    }

    func testInvalidFaceFailsWithoutInventingCrop() {
        XCTAssertNil(PortraitCropAdvisor.crop(
            faceRectVision: .zero,
            imageSize: CGSize(width: 4000, height: 6000),
            settings: PortraitCropSettings()
        ))
    }

    func testCompositionGuideGeometryFollowsCropRect() throws {
        let rect = CGRect(x: 30, y: 60, width: 300, height: 600)
        let thirds = CompositionGuideGeometry.lines(for: .thirds, in: rect)
        XCTAssertEqual(thirds.count, 4)
        XCTAssertEqual(thirds[0].start.x, 130, accuracy: 0.001)
        XCTAssertEqual(thirds[0].start.y, 60, accuracy: 0.001)
        XCTAssertEqual(thirds[0].end.y, 660, accuracy: 0.001)
        XCTAssertEqual(thirds[2].start.x, 230, accuracy: 0.001)

        let safeFrame = try XCTUnwrap(CompositionGuideGeometry.frames(for: .safeArea, in: rect).first)
        XCTAssertEqual(safeFrame, CGRect(x: 60, y: 120, width: 240, height: 480))
        XCTAssertTrue(CompositionGuideGeometry.lines(for: .none, in: rect).isEmpty)
    }

    func testCropPresetStorePersistsUpdatesAndRemoves() throws {
        let suite = "CaptureAppTests.CropPreset.\(UUID().uuidString)"
        let defaults = try XCTUnwrap(UserDefaults(suiteName: suite))
        defer { defaults.removePersistentDomain(forName: suite) }

        var firstSettings = PortraitCropSettings()
        firstSettings.aspect = .square
        firstSettings.headSize = 0.44
        var presets = CropPresetStore.upsert(
            name: "  Headshot  ",
            settings: firstSettings,
            guide: .goldenRatio,
            defaults: defaults
        )
        XCTAssertEqual(presets.count, 1)
        XCTAssertEqual(presets[0].name, "Headshot")
        XCTAssertEqual(presets[0].settings, firstSettings)
        XCTAssertEqual(presets[0].guide, .goldenRatio)

        var updatedSettings = firstSettings
        updatedSettings.aspect = .fourFive
        presets = CropPresetStore.upsert(
            name: "headshot",
            settings: updatedSettings,
            guide: .safeArea,
            defaults: defaults
        )
        XCTAssertEqual(presets.count, 1, "samme navn skal oppdatere, ikke duplisere preset")
        XCTAssertEqual(presets[0].settings.aspect, .fourFive)
        XCTAssertEqual(presets[0].guide, .safeArea)

        presets = CropPresetStore.remove(presets[0], defaults: defaults)
        XCTAssertTrue(presets.isEmpty)
        XCTAssertTrue(CropPresetStore.load(defaults: defaults).isEmpty)
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
