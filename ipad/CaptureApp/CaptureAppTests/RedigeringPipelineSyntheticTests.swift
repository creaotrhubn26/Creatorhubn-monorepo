import XCTest
import UIKit
import CoreImage
@testable import CaptureApp

/// Pixel-nivå-dekning av Redigering-pipelinen UTEN en ekte CR2 — kjører derfor
/// ALLTID i CI (der RedigeringRawPipelineTests XCTSkip-er fordi RAW-fixturet
/// ikke er buntet). Genererer et syntetisk farge/tone-bilde i kode og beviser at
/// hver redigerings-akse (eksponering, beskjær, kontrast, metning, fargebalanse,
/// high/low-freq hud) faktisk ENDRER de rendrede pikslene — ikke bare no-op-er.
final class RedigeringPipelineSyntheticTests: XCTestCase {

    /// Syntetisk testbilde: diagonal grå→hvit-gradient med et mettet farge-felt,
    /// så både luma-, metning- og hvitbalanse-akser har noe å gripe fatt i.
    private func makeImage(_ side: CGFloat = 256) -> UIImage {
        let renderer = UIGraphicsImageRenderer(size: CGSize(width: side, height: side))
        return renderer.image { ctx in
            let cg = ctx.cgContext
            let cs = CGColorSpaceCreateDeviceRGB()
            let grad = CGGradient(colorsSpace: cs,
                                  colors: [UIColor(white: 0.15, alpha: 1).cgColor,
                                           UIColor(white: 0.85, alpha: 1).cgColor] as CFArray,
                                  locations: [0, 1])!
            cg.drawLinearGradient(grad, start: .zero, end: CGPoint(x: side, y: side), options: [])
            // Mettet felt (rødt + blått) for metning/varme-følsomhet.
            UIColor(red: 0.85, green: 0.2, blue: 0.2, alpha: 1).setFill()
            cg.fill(CGRect(x: 0, y: 0, width: side * 0.5, height: side * 0.5))
            UIColor(red: 0.2, green: 0.35, blue: 0.85, alpha: 1).setFill()
            cg.fill(CGRect(x: side * 0.5, y: side * 0.5, width: side * 0.5, height: side * 0.5))
        }
    }

    private func tone(_ recipe: MagicRecipe, _ base: UIImage) throws -> CGImage {
        let ci = try XCTUnwrap(CIImage(image: base))
        let out = RAWExportPipeline.applyToneAdjustments(recipe: recipe, to: ci)
        let ctx = CIContext(options: [.useSoftwareRenderer: true])
        return try XCTUnwrap(ctx.createCGImage(out, from: ci.extent))
    }

    // MARK: - Eksponering (RedigeringPipeline.applyExposure)

    func testExposureBrightensAndDarkens() throws {
        let base = makeImage()
        let baseLuma = Self.meanLuma(try XCTUnwrap(base.cgImage))
        let brighter = try XCTUnwrap(RedigeringPipeline.applyExposure(1.5, to: base))
        let darker = try XCTUnwrap(RedigeringPipeline.applyExposure(-1.5, to: base))
        XCTAssertGreaterThan(Self.meanLuma(try XCTUnwrap(brighter.cgImage)), baseLuma, "+1.5 EV lysnet ikke")
        XCTAssertLessThan(Self.meanLuma(try XCTUnwrap(darker.cgImage)), baseLuma, "-1.5 EV mørknet ikke")
    }

    // MARK: - Beskjær (RedigeringPipeline.cropped)

    func testCropProducesHalfSize() throws {
        let base = makeImage(256)
        let fullW = try XCTUnwrap(base.cgImage).width
        let cropped = RedigeringPipeline.cropped(base, to: CGRect(x: 0.25, y: 0.25, width: 0.5, height: 0.5))
        let cw = try XCTUnwrap(cropped.cgImage).width
        XCTAssertEqual(Double(cw), Double(fullW) * 0.5, accuracy: 2, "crop-bredde != 50% av kilde")
        XCTAssertLessThan(cw, fullW, "crop krympet ikke bildet")
    }

    // MARK: - Tone-akser (RAWExportPipeline.applyToneAdjustments)

    func testContrastChangesPixels() throws {
        let base = makeImage()
        let neutralLuma = Self.stdevLuma(try tone(.neutral, base))
        var c = MagicRecipe.neutral; c.contrast = 1.0
        let hiContrast = Self.stdevLuma(try tone(c, base))
        // Økt kontrast → større luma-spredning (mørke mørkere, lyse lysere).
        XCTAssertGreaterThan(hiContrast, neutralLuma, "kontrast +1.0 økte ikke luma-spredningen")
    }

    func testSaturationChangesColorSpread() throws {
        let base = makeImage()
        let neutral = Self.meanChroma(try tone(.neutral, base))
        var s = MagicRecipe.neutral; s.saturation = 1.0
        let saturated = Self.meanChroma(try tone(s, base))
        XCTAssertGreaterThan(saturated, neutral, "metning +1.0 økte ikke fargespredningen")
    }

    func testTintChangesGreenMagentaBalance() throws {
        let base = makeImage()
        let neutral = Self.meanRedMinusGreen(try tone(.neutral, base))
        var tinted = MagicRecipe.neutral
        tinted.tint = 0.8
        let magenta = Self.meanRedMinusGreen(try tone(tinted, base))
        XCTAssertGreaterThan(magenta, neutral, "positiv tint flyttet ikke fargen mot magenta")
    }

    func testPhotographicWarmthUsesTheExpectedDirection() throws {
        let extent = CGRect(x: 0, y: 0, width: 64, height: 64)
        let input = CIImage(
            color: CIColor(red: 0.55, green: 0.45, blue: 0.35)
        ).cropped(to: extent)
        let context = CIContext(options: [.useSoftwareRenderer: true])
        let neutral = try XCTUnwrap(context.createCGImage(input, from: extent))
        let warm = try XCTUnwrap(context.createCGImage(
            PhotographicTemperatureFilter.apply(to: input, warmth: 0.8, kelvinScale: 900),
            from: extent
        ))
        let cool = try XCTUnwrap(context.createCGImage(
            PhotographicTemperatureFilter.apply(to: input, warmth: -0.8, kelvinScale: 900),
            from: extent
        ))

        XCTAssertGreaterThan(
            Self.meanRedMinusBlue(warm),
            Self.meanRedMinusBlue(neutral),
            "positiv varme må gjøre bildet varmere, ikke kjøligere"
        )
        XCTAssertLessThan(
            Self.meanRedMinusBlue(cool),
            Self.meanRedMinusBlue(neutral),
            "negativ varme må nøytralisere rødt/oransje stikk"
        )
    }

    func testDefringeReducesPurpleOnlyAtEdges() throws {
        let size = CGSize(width: 128, height: 64)
        let source = UIGraphicsImageRenderer(size: size).image { context in
            UIColor(white: 0.08, alpha: 1).setFill()
            context.fill(CGRect(origin: .zero, size: size))
            UIColor(white: 0.92, alpha: 1).setFill()
            context.fill(CGRect(x: 64, y: 0, width: 64, height: 64))
            UIColor(red: 0.78, green: 0.16, blue: 0.84, alpha: 1).setFill()
            context.fill(CGRect(x: 61, y: 0, width: 6, height: 64))
        }
        let input = try XCTUnwrap(CIImage(image: source))
        let output = ColorArtifactFilter.applyDefringe(amount: 1, to: input)
        let context = CIContext(options: [.useSoftwareRenderer: true])
        let before = try XCTUnwrap(context.createCGImage(input, from: input.extent))
        let after = try XCTUnwrap(context.createCGImage(output, from: output.extent))
        let beforeEdge = Self.pixel(before, normalizedPoint: CGPoint(x: 0.48, y: 0.5))
        let afterEdge = Self.pixel(after, normalizedPoint: CGPoint(x: 0.48, y: 0.5))
        XCTAssertLessThan(
            Self.chroma(afterEdge),
            Self.chroma(beforeEdge) - 0.01,
            "defringe reduserte ikke lilla farge ved kontrastkanten"
        )

        let flatPurple = CIImage(color: CIColor(red: 0.7, green: 0.15, blue: 0.78))
            .cropped(to: CGRect(origin: .zero, size: size))
        let flatOutput = ColorArtifactFilter.applyDefringe(amount: 1, to: flatPurple)
        let flatBefore = try XCTUnwrap(context.createCGImage(flatPurple, from: flatPurple.extent))
        let flatAfter = try XCTUnwrap(context.createCGImage(flatOutput, from: flatOutput.extent))
        XCTAssertEqual(
            Self.chroma(Self.pixel(flatAfter, normalizedPoint: CGPoint(x: 0.5, y: 0.5))),
            Self.chroma(Self.pixel(flatBefore, normalizedPoint: CGPoint(x: 0.5, y: 0.5))),
            accuracy: 2.0 / 255.0,
            "defringe endret en ekte, flat lilla flate uten en kant"
        )
    }

    func testGreenControlRestrainsFoliageWithoutMovingNeutralColour() throws {
        let extent = CGRect(x: 0, y: 0, width: 128, height: 64)
        let image = UIGraphicsImageRenderer(size: extent.size).image { context in
            UIColor(red: 0.18, green: 0.70, blue: 0.20, alpha: 1).setFill()
            context.fill(CGRect(x: 0, y: 0, width: 64, height: 64))
            UIColor(white: 0.55, alpha: 1).setFill()
            context.fill(CGRect(x: 64, y: 0, width: 64, height: 64))
        }
        let input = try XCTUnwrap(CIImage(image: image))
        let output = ColorArtifactFilter.applyGreenControl(amount: 1, to: input)
        let context = CIContext(options: [.useSoftwareRenderer: true])
        let before = try XCTUnwrap(context.createCGImage(input, from: input.extent))
        let after = try XCTUnwrap(context.createCGImage(output, from: output.extent))
        XCTAssertLessThan(
            Self.chroma(Self.pixel(after, normalizedPoint: CGPoint(x: 0.25, y: 0.5))),
            Self.chroma(Self.pixel(before, normalizedPoint: CGPoint(x: 0.25, y: 0.5))) * 0.75
        )
        let neutralBefore = Self.pixel(before, normalizedPoint: CGPoint(x: 0.75, y: 0.5))
        let neutralAfter = Self.pixel(after, normalizedPoint: CGPoint(x: 0.75, y: 0.5))
        XCTAssertEqual(neutralAfter.r, neutralBefore.r, accuracy: 1.0 / 255.0)
        XCTAssertEqual(neutralAfter.g, neutralBefore.g, accuracy: 1.0 / 255.0)
        XCTAssertEqual(neutralAfter.b, neutralBefore.b, accuracy: 1.0 / 255.0)
    }

    func testPortraitFinishAddsDepthAndSelectiveColour() throws {
        let base = makeImage()
        let source = try XCTUnwrap(base.cgImage)
        let portrait = try tone(.portrait, base)

        XCTAssertGreaterThan(
            Self.stdevLuma(portrait),
            Self.stdevLuma(source) * 1.03,
            "portrettpresetet ga ikke et tydelig svart-/midtoneanker"
        )
        XCTAssertGreaterThan(
            Self.meanChroma(portrait),
            Self.meanChroma(source),
            "portrettpresetet lot fargene forbli blasse"
        )
    }

    func testBundledPortraitFinishIsNotFlatOrFaded() throws {
        let sourceURL = try XCTUnwrap(Bundle.main.url(
            forResource: "creatorhub-editor-portrait",
            withExtension: "jpg"
        ))
        let source = try XCTUnwrap(UIImage(contentsOfFile: sourceURL.path)?.cgImage)
        let rendered = try XCTUnwrap(MagicPipeline.renderPreview(
            source: sourceURL.path,
            recipe: .portrait
        )?.cgImage)

        // Keep a clean, UI-free candidate for the external SIFT/pixel-diff QA
        // tool. xcresulttool can export this without test-only filesystem paths.
        let qaAttachment = XCTAttachment(image: UIImage(cgImage: rendered))
        qaAttachment.name = "creatorhub-portrait-after"
        qaAttachment.lifetime = .keepAlways
        add(qaAttachment)

        XCTAssertGreaterThan(
            Self.stdevLuma(rendered),
            Self.stdevLuma(source) * 0.88,
            "høylysskulderen komprimerte toneomfanget for mye"
        )
        XCTAssertGreaterThan(
            Self.meanChroma(rendered),
            Self.meanChroma(source),
            "det faktiske QA-portrettet mistet fargedybde"
        )
        XCTAssertLessThan(
            Self.lumaPercentile(rendered, percentile: 0.10),
            Self.lumaPercentile(source, percentile: 0.10),
            "svartpunktet fikk ikke et tydeligere anker"
        )
        XCTAssertGreaterThan(
            Self.lumaPercentile(rendered, percentile: 0.90),
            Self.lumaPercentile(source, percentile: 0.90) * 0.90,
            "de lyse mellomtonene ble presset for langt ned"
        )
        XCTAssertLessThan(
            Self.meanRedMinusBlue(rendered),
            Self.meanRedMinusBlue(source),
            "den varme helhetsstikken ble ikke redusert"
        )
    }

    // MARK: - JPEG-fallback ende-til-ende (renderExport uten RAW)

    func testJpegFallbackExportAppliesRecipeAndCrop() throws {
        let base = makeImage(512)
        let jpeg = try XCTUnwrap(base.jpegData(compressionQuality: 0.95))
        let tmp = FileManager.default.temporaryDirectory.appendingPathComponent("redig_synt.jpg")
        try jpeg.write(to: tmp)
        defer { try? FileManager.default.removeItem(at: tmp) }

        // Ukroppet eksport → mål render-banens faktiske utdata-bredde (renderPreview
        // kan skalere), så crop-forholdet måles relativt til den, ikke kilden.
        let uncropped = try XCTUnwrap(RedigeringPipeline.renderExport(
            rawPath: nil, jpegPath: tmp.path, recipe: .product, exposureEV: 0))
        let uncroppedW = try XCTUnwrap(UIImage(data: uncropped)?.cgImage).width

        let out = try XCTUnwrap(RedigeringPipeline.renderExport(
            rawPath: nil, jpegPath: tmp.path, recipe: .product,
            exposureEV: 1.0, crop: CGRect(x: 0.25, y: 0.25, width: 0.5, height: 0.5)))
        let img = try XCTUnwrap(UIImage(data: out))
        let w = try XCTUnwrap(img.cgImage).width
        // Crop halverer render-banens utdata, og resultatet er et gyldig, ikke-svart bilde.
        XCTAssertEqual(Double(w), Double(uncroppedW) * 0.5, accuracy: 4, "eksport-crop halverte ikke bredden")
        XCTAssertLessThan(w, uncroppedW, "eksport-crop krympet ikke bildet")
        XCTAssertGreaterThan(Self.meanLuma(try XCTUnwrap(img.cgImage)), 0.02, "eksport rendret svart/tomt")
    }

    func testLocalFaceEditIsIncludedInFullResolutionExport() throws {
        let base = makeImage(512)
        let jpeg = try XCTUnwrap(base.jpegData(compressionQuality: 0.95))
        let tmp = FileManager.default.temporaryDirectory.appendingPathComponent("redig_local_face.jpg")
        try jpeg.write(to: tmp)
        defer { try? FileManager.default.removeItem(at: tmp) }

        let baseline = try XCTUnwrap(RedigeringPipeline.renderExport(
            rawPath: nil, jpegPath: tmp.path, recipe: .portrait, exposureEV: 0
        ))
        let edited = try XCTUnwrap(RedigeringPipeline.renderExport(
            rawPath: nil,
            jpegPath: tmp.path,
            recipe: .portrait,
            exposureEV: 0,
            faceEdits: [.init(
                normalizedRect: CGRect(x: 0.25, y: 0.25, width: 0.5, height: 0.5),
                adjustment: .init(brightness: 0.7, warmth: 0)
            )]
        ))
        let baselineImage = try XCTUnwrap(UIImage(data: baseline)?.cgImage)
        let editedImage = try XCTUnwrap(UIImage(data: edited)?.cgImage)
        XCTAssertGreaterThan(
            Self.centerLuma(editedImage),
            Self.centerLuma(baselineImage) + 0.01,
            "lokal ansiktsjustering manglet i eksporten"
        )
    }

    func testProtectedRegionRestoresDetailBaselineOnlyInsideSelection() throws {
        let edited = UIGraphicsImageRenderer(size: CGSize(width: 100, height: 100)).image { context in
            UIColor.red.setFill(); context.fill(CGRect(x: 0, y: 0, width: 100, height: 100))
        }
        let baseline = UIGraphicsImageRenderer(size: CGSize(width: 100, height: 100)).image { context in
            UIColor.blue.setFill(); context.fill(CGRect(x: 0, y: 0, width: 100, height: 100))
        }
        let output = RedigeringPipeline.applyProtectedRegions(
            [CGRect(x: 0.25, y: 0.25, width: 0.5, height: 0.5)],
            to: edited,
            baseline: baseline
        )
        let cg = try XCTUnwrap(output.cgImage)
        let center = Self.pixel(cg, normalizedPoint: CGPoint(x: 0.5, y: 0.5))
        let corner = Self.pixel(cg, normalizedPoint: CGPoint(x: 0.05, y: 0.05))
        XCTAssertGreaterThan(center.b, center.r, "beskyttet område beholdt ikke detaljbasen")
        XCTAssertGreaterThan(corner.r, corner.b, "retusj utenfor beskyttelsen ble feilaktig fjernet")
    }

    func testFrequencyRetouchIsConfinedToFaceMask() throws {
        let base = makeTextureImage(256)
        let input = try XCTUnwrap(CIImage(image: base))
        var recipe = MagicRecipe.neutral
        recipe.skinLowFreq = 0.95
        recipe.skinHighFreq = -0.65
        let extent = input.extent
        let face = CGRect(
            x: extent.minX + extent.width * 0.28,
            y: extent.minY + extent.height * 0.22,
            width: extent.width * 0.44,
            height: extent.height * 0.56
        )
        let output = SkinFinishFilter.applyFrequencySeparation(
            recipe: recipe,
            to: input,
            faceRects: [face]
        )
        let context = CIContext(options: [.useSoftwareRenderer: true])
        let before = try XCTUnwrap(context.createCGImage(input, from: input.extent))
        let after = try XCTUnwrap(context.createCGImage(output, from: input.extent))

        let faceDifference = Self.meanDifference(
            before,
            after,
            normalizedRect: CGRect(x: 0.38, y: 0.35, width: 0.24, height: 0.30)
        )
        let cornerDifference = Self.meanDifference(
            before,
            after,
            normalizedRect: CGRect(x: 0.02, y: 0.02, width: 0.18, height: 0.18)
        )
        XCTAssertGreaterThan(faceDifference, 0.002, "hudretusjeringen endret ikke ansiktsområdet")
        XCTAssertLessThan(cornerDifference, 0.0008, "hudretusjeringen lekket ut i bakgrunnen")
        XCTAssertGreaterThan(faceDifference, cornerDifference * 5, "ansiktsmasken isolerte ikke retusjeringen")
    }

    func testPortraitRetouchKeepsFacialTextureAndDimension() throws {
        let base = makeTextureImage(256)
        let input = try XCTUnwrap(CIImage(image: base))
        let extent = input.extent
        let face = CGRect(
            x: extent.minX + extent.width * 0.28,
            y: extent.minY + extent.height * 0.22,
            width: extent.width * 0.44,
            height: extent.height * 0.56
        )
        let output = SkinFinishFilter.applyFrequencySeparation(
            recipe: .portrait,
            to: input,
            faceRects: [face]
        )
        let context = CIContext(options: [.useSoftwareRenderer: true])
        let before = try XCTUnwrap(context.createCGImage(input, from: extent))
        let after = try XCTUnwrap(context.createCGImage(output, from: extent))
        let sampleRect = CGRect(x: 0.38, y: 0.35, width: 0.24, height: 0.30)
        let beforeContrast = Self.regionalLumaDeviation(before, normalizedRect: sampleRect)
        let afterContrast = Self.regionalLumaDeviation(after, normalizedRect: sampleRect)
        XCTAssertGreaterThan(
            afterContrast,
            beforeContrast * 0.78,
            "portrettretusjeringen fjernet for mye hudtekstur og ansiktsdimensjon"
        )
    }

    func testSkinColourProtectionPullsChromaTowardSourceWithoutChangingBackground() throws {
        let extent = CGRect(x: 0, y: 0, width: 128, height: 128)
        let reference = CIImage(color: CIColor(red: 0.64, green: 0.40, blue: 0.31)).cropped(to: extent)
        let shifted = CIImage(color: CIColor(red: 0.77, green: 0.34, blue: 0.20)).cropped(to: extent)
        let face = CGRect(x: 32, y: 24, width: 64, height: 80)
        let protected = SkinToneGuardFilter.preserveReferenceColor(
            strength: 1,
            image: shifted,
            reference: reference,
            faces: [face]
        )
        let context = CIContext(options: [.useSoftwareRenderer: true])
        let referenceCG = try XCTUnwrap(context.createCGImage(reference, from: extent))
        let shiftedCG = try XCTUnwrap(context.createCGImage(shifted, from: extent))
        let protectedCG = try XCTUnwrap(context.createCGImage(protected, from: extent))
        let source = Self.pixel(referenceCG, normalizedPoint: CGPoint(x: 0.5, y: 0.5))
        let before = Self.pixel(shiftedCG, normalizedPoint: CGPoint(x: 0.5, y: 0.5))
        let after = Self.pixel(protectedCG, normalizedPoint: CGPoint(x: 0.5, y: 0.5))
        let outsideBefore = Self.pixel(shiftedCG, normalizedPoint: CGPoint(x: 0.05, y: 0.05))
        let outsideAfter = Self.pixel(protectedCG, normalizedPoint: CGPoint(x: 0.05, y: 0.05))

        XCTAssertLessThan(
            Self.chromaDistance(after, source),
            Self.chromaDistance(before, source),
            "hudtonebeskyttelsen trakk ikke fargen tilbake mot kildebildet"
        )
        XCTAssertEqual(outsideAfter.r, outsideBefore.r, accuracy: 1.0 / 255.0)
        XCTAssertEqual(outsideAfter.g, outsideBefore.g, accuracy: 1.0 / 255.0)
        XCTAssertEqual(outsideAfter.b, outsideBefore.b, accuracy: 1.0 / 255.0)
    }

    // MARK: - Helpers (32×32 nedsamplet grid)

    private static func sample(_ cg: CGImage) -> [UInt8] {
        let w = 32, h = 32
        var px = [UInt8](repeating: 0, count: w * h * 4)
        let cs = CGColorSpaceCreateDeviceRGB()
        let ctx = CGContext(data: &px, width: w, height: h, bitsPerComponent: 8,
                            bytesPerRow: w * 4, space: cs,
                            bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue)
        ctx?.draw(cg, in: CGRect(x: 0, y: 0, width: w, height: h))
        return px
    }

    private static func meanLuma(_ cg: CGImage) -> Double {
        let px = sample(cg)
        var sum = 0.0
        for i in stride(from: 0, to: px.count, by: 4) {
            sum += 0.299 * Double(px[i]) + 0.587 * Double(px[i + 1]) + 0.114 * Double(px[i + 2])
        }
        return sum / Double(px.count / 4) / 255.0
    }

    private static func centerLuma(_ cg: CGImage) -> Double {
        let x = cg.width / 2, y = cg.height / 2
        guard let one = cg.cropping(to: CGRect(x: x, y: y, width: 1, height: 1)) else { return 0 }
        var pixel = [UInt8](repeating: 0, count: 4)
        CGContext(
            data: &pixel,
            width: 1,
            height: 1,
            bitsPerComponent: 8,
            bytesPerRow: 4,
            space: CGColorSpaceCreateDeviceRGB(),
            bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue
        )?.draw(one, in: CGRect(x: 0, y: 0, width: 1, height: 1))
        return (0.299 * Double(pixel[0]) + 0.587 * Double(pixel[1]) + 0.114 * Double(pixel[2])) / 255
    }

    private static func stdevLuma(_ cg: CGImage) -> Double {
        let px = sample(cg)
        var vals: [Double] = []
        for i in stride(from: 0, to: px.count, by: 4) {
            vals.append((0.299 * Double(px[i]) + 0.587 * Double(px[i + 1]) + 0.114 * Double(px[i + 2])) / 255.0)
        }
        let m = vals.reduce(0, +) / Double(vals.count)
        return (vals.reduce(0) { $0 + ($1 - m) * ($1 - m) } / Double(vals.count)).squareRoot()
    }

    private static func lumaPercentile(_ cg: CGImage, percentile: Double) -> Double {
        let px = sample(cg)
        var values: [Double] = []
        for index in stride(from: 0, to: px.count, by: 4) {
            values.append(
                (0.299 * Double(px[index])
                 + 0.587 * Double(px[index + 1])
                 + 0.114 * Double(px[index + 2])) / 255
            )
        }
        values.sort()
        let bounded = min(1, max(0, percentile))
        return values[Int((Double(values.count - 1) * bounded).rounded())]
    }

    private static func meanChroma(_ cg: CGImage) -> Double {
        let px = sample(cg)
        var sum = 0.0
        for i in stride(from: 0, to: px.count, by: 4) {
            let r = Double(px[i]), g = Double(px[i + 1]), b = Double(px[i + 2])
            let mx = max(r, g, b), mn = min(r, g, b)
            sum += (mx - mn)
        }
        return sum / Double(px.count / 4) / 255.0
    }

    private static func meanRedMinusGreen(_ cg: CGImage) -> Double {
        let px = sample(cg)
        var sum = 0.0
        for i in stride(from: 0, to: px.count, by: 4) {
            sum += Double(px[i]) - Double(px[i + 1])
        }
        return sum / Double(px.count / 4) / 255.0
    }

    private static func meanRedMinusBlue(_ cg: CGImage) -> Double {
        let px = sample(cg)
        var sum = 0.0
        for i in stride(from: 0, to: px.count, by: 4) {
            sum += Double(px[i]) - Double(px[i + 2])
        }
        return sum / Double(px.count / 4) / 255.0
    }

    private func makeTextureImage(_ side: CGFloat) -> UIImage {
        let renderer = UIGraphicsImageRenderer(size: CGSize(width: side, height: side))
        return renderer.image { context in
            UIColor(red: 0.55, green: 0.42, blue: 0.34, alpha: 1).setFill()
            context.fill(CGRect(x: 0, y: 0, width: side, height: side))
            for y in stride(from: CGFloat(0), to: side, by: 5) {
                let bright = Int(y / 5).isMultiple(of: 2)
                UIColor(white: bright ? 0.72 : 0.28, alpha: 0.34).setFill()
                context.fill(CGRect(x: 0, y: y, width: side, height: 2))
            }
            for x in stride(from: CGFloat(0), to: side, by: 9) {
                UIColor(white: 0.9, alpha: 0.18).setFill()
                context.fill(CGRect(x: x, y: 0, width: 2, height: side))
            }
        }
    }

    private static func meanDifference(
        _ lhs: CGImage,
        _ rhs: CGImage,
        normalizedRect: CGRect
    ) -> Double {
        let left = sample(lhs)
        let right = sample(rhs)
        let size = 32
        let minX = max(0, Int(normalizedRect.minX * CGFloat(size)))
        let maxX = min(size, Int(ceil(normalizedRect.maxX * CGFloat(size))))
        let minY = max(0, Int(normalizedRect.minY * CGFloat(size)))
        let maxY = min(size, Int(ceil(normalizedRect.maxY * CGFloat(size))))
        var sum = 0.0
        var count = 0
        for y in minY..<maxY {
            for x in minX..<maxX {
                let index = (y * size + x) * 4
                for channel in 0..<3 {
                    sum += abs(Double(left[index + channel]) - Double(right[index + channel])) / 255.0
                    count += 1
                }
            }
        }
        return count > 0 ? sum / Double(count) : 0
    }

    private static func regionalLumaDeviation(
        _ image: CGImage,
        normalizedRect: CGRect
    ) -> Double {
        let pixelRect = CGRect(
            x: normalizedRect.minX * CGFloat(image.width),
            y: normalizedRect.minY * CGFloat(image.height),
            width: normalizedRect.width * CGFloat(image.width),
            height: normalizedRect.height * CGFloat(image.height)
        ).integral
        guard let region = image.cropping(to: pixelRect) else { return 0 }
        // Crop before the 32×32 sampling pass. Sampling the full Retina image
        // first averaged the synthetic pore pattern away and measured resize
        // aliasing rather than retained facial detail.
        let pixels = sample(region)
        var values: [Double] = []
        for index in stride(from: 0, to: pixels.count, by: 4) {
            values.append(
                (0.299 * Double(pixels[index])
                 + 0.587 * Double(pixels[index + 1])
                 + 0.114 * Double(pixels[index + 2])) / 255
            )
        }
        guard !values.isEmpty else { return 0 }
        let mean = values.reduce(0, +) / Double(values.count)
        return (values.reduce(0) { $0 + pow($1 - mean, 2) } / Double(values.count)).squareRoot()
    }

    private static func pixel(
        _ image: CGImage,
        normalizedPoint: CGPoint
    ) -> (r: Double, g: Double, b: Double) {
        let pixels = sample(image)
        let x = min(31, max(0, Int(normalizedPoint.x * 32)))
        let y = min(31, max(0, Int(normalizedPoint.y * 32)))
        let index = (y * 32 + x) * 4
        return (
            Double(pixels[index]) / 255,
            Double(pixels[index + 1]) / 255,
            Double(pixels[index + 2]) / 255
        )
    }

    private static func chromaDistance(
        _ lhs: (r: Double, g: Double, b: Double),
        _ rhs: (r: Double, g: Double, b: Double)
    ) -> Double {
        let lhsRG = lhs.r - lhs.g
        let lhsBG = lhs.b - lhs.g
        let rhsRG = rhs.r - rhs.g
        let rhsBG = rhs.b - rhs.g
        return hypot(lhsRG - rhsRG, lhsBG - rhsBG)
    }

    private static func chroma(_ value: (r: Double, g: Double, b: Double)) -> Double {
        max(value.r, value.g, value.b) - min(value.r, value.g, value.b)
    }
}
