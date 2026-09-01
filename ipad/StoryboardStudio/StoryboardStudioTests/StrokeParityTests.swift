import XCTest
import Metal
import UIKit
@testable import StoryboardStudio

final class StrokeParityTests: XCTestCase {
    @MainActor
    func testCanvasUndoRedoRoundtripAndBranchInvalidation() throws {
        let state = CanvasState()
        let brush = BrushSpec.preset(
            .pencil, size: 6, color: "#26282e", opacity: 0.95)
        let first = PencilStroke(
            id: "undo-first",
            points: [StrokePoint(x: 10, y: 20, pressure: 0.7,
                                 tiltX: 0, tiltY: 0, timestamp: 1)],
            inputType: "pencil", color: brush.color, width: brush.size,
            opacity: brush.opacity, brush: brush)
        let second = PencilStroke(
            id: "undo-second",
            points: [StrokePoint(x: 30, y: 40, pressure: 0.8,
                                 tiltX: 0, tiltY: 0, timestamp: 2)],
            inputType: "pencil", color: brush.color, width: brush.size,
            opacity: brush.opacity, brush: brush)

        state.captureUndo("Tegn")
        state.strokes.append(first)
        state.undo()
        XCTAssertTrue(state.strokes.isEmpty)
        XCTAssertEqual(state.redoStack.last?.snapshot.strokes, [first])

        state.redo()
        XCTAssertEqual(state.strokes, [first])
        XCTAssertTrue(state.redoStack.isEmpty)

        state.undo()
        state.captureUndo("Ny gren")
        state.strokes.append(second)
        XCTAssertEqual(state.strokes, [second])
        XCTAssertTrue(state.redoStack.isEmpty,
                      "et nytt strøk etter undo må bryte redo-grenen")
    }

    @MainActor
    func testCanvasEnablesMultiTouchForUndoRedoGestures() {
        let canvas = MetalCanvasUIView(frame: .zero)
        XCTAssertTrue(canvas.isMultipleTouchEnabled)
        let tapCounts = canvas.gestureRecognizers?
            .compactMap { ($0 as? UITapGestureRecognizer)?.numberOfTouchesRequired } ?? []
        XCTAssertTrue(tapCounts.contains(2))
        XCTAssertTrue(tapCounts.contains(3))
    }

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

    func testBrushEngine2PoseAndMaterialRoundtrip() throws {
        let point = StrokePoint(
            x: 10, y: 20, pressure: 0.72, tiltX: 31, tiltY: -12,
            timestamp: 42, rollAngle: 0, altitudeAngle: 0.61,
            azimuthAngle: 5.9, velocity: 284,
            estimationUpdateIndex: 17, estimatedProperties: 3)
        let brush = BrushSpec.preset(.dryink, size: 7, color: "#26282e", opacity: 0.72)
        let stroke = PencilStroke(id: "v2", points: [point], inputType: "pencil",
                                  color: brush.color, width: brush.size,
                                  opacity: brush.opacity, brush: brush)
        let json = try StrokeSerialization.encodeToWebJSON([stroke])
        let decoded = try XCTUnwrap(StrokeSerialization.decodeFromWebJSON(json).first)
        XCTAssertEqual(decoded, stroke)
        XCTAssertEqual(decoded.engineVersion, BrushEngineVersion.current)
        XCTAssertEqual(decoded.points.first?.rollAngle, 0, "0° er gyldig roll, ikke missing")
        XCTAssertEqual(decoded.brush?.tipModel, .filament)
        XCTAssertEqual(decoded.brush?.material, .ink)
        XCTAssertEqual(decoded.brush?.paperProfile, .rough)
        XCTAssertEqual(decoded.brush?.bristleCount, 5)
    }

    func testBrushCatalogCoversEveryTypeExactlyOnce() {
        XCTAssertEqual(Set(BrushCatalog.all), Set(BrushType.allCases))
        XCTAssertEqual(BrushCatalog.all.count, Set(BrushCatalog.all).count)
        for type in BrushType.allCases where type != .smudge {
            XCTAssertNotNil(StampConfig.forBrush(type), "mangler StampConfig for \(type.rawValue)")
        }
    }

    func testTraditionalStudioCollectionsAreCompleteAndPersistable() throws {
        let expected: [(BrushCategory, String, [BrushType])] = [
            (.sketchbook, "Sketchbook", [.sketchHB, .sketch6B, .sketchTilt]),
            (.colorPencil, "Fargeblyant", [.colorHard, .colorSoft, .colorShade]),
            (.studioGraphite, "Studio Graphite", [.studio2H, .studioHB, .studio4B]),
            (.drawingBox, "Tegnekasse", [.vineCharcoal, .blockCharcoal, .softPastel]),
            (.dryNib, "Dry Nib", [.nibFine, .nibRough, .nibBrush]),
            (.printTone, "Print Tones", [.toneDots, .toneLines, .toneCross]),
            (.comicColor, "Comic Color", [.comicFlat, .comicShade]),
            (.precisionStipple, "Precision Stipple", [.stippleFine, .stippleRough, .stippleFill]),
        ]

        for (category, title, brushes) in expected {
            let section = try XCTUnwrap(BrushCatalog.sections.first { $0.category == category })
            XCTAssertEqual(section.title, title)
            XCTAssertEqual(section.brushes, brushes)
            for type in brushes {
                XCTAssertNotNil(StampConfig.forBrush(type), "mangler renderer for \(type.rawValue)")
                XCTAssertNotNil(BrushDefaults.sizeAndOpacity(for: type))
                XCTAssertFalse(BrushCatalog.displayName(type).isEmpty)

                let brush = BrushSpec.preset(type, size: 12, color: "#486d91", opacity: 0.7)
                let stroke = PencilStroke(
                    id: "family-\(type.rawValue)",
                    points: [StrokePoint(x: 1, y: 2, pressure: 0.7,
                                         tiltX: 35, tiltY: 12, timestamp: 1)],
                    inputType: "pencil", color: brush.color, width: brush.size,
                    opacity: brush.opacity, brush: brush)
                let decoded = try StrokeSerialization.decodeFromWebJSON(
                    StrokeSerialization.encodeToWebJSON([stroke]))
                XCTAssertEqual(decoded.first?.brush?.type, type)
                XCTAssertEqual(decoded.first?.brush?.engineVersion, BrushEngineVersion.current)
            }
        }
    }

    func testTraditionalStudioPhysicsMatchTheMedium() {
        XCTAssertEqual(BrushPhysicsCatalog.profile(for: .sketchTilt).tipModel, .ribbon)
        XCTAssertEqual(BrushPhysicsCatalog.profile(for: .vineCharcoal).material, .charcoal)
        XCTAssertEqual(BrushPhysicsCatalog.profile(for: .softPastel).material, .chalk)
        XCTAssertEqual(BrushPhysicsCatalog.profile(for: .nibFine).bristleCount, 1)
        XCTAssertEqual(BrushPhysicsCatalog.profile(for: .nibRough).bristleCount, 5)
        XCTAssertEqual(BrushPhysicsCatalog.profile(for: .nibBrush).bristleCount, 9)
        XCTAssertEqual(BrushPhysicsCatalog.profile(for: .comicFlat).material, .marker)
        XCTAssertTrue(StampConfig.forBrush(.toneDots)?.halftoneGrid == true)
        XCTAssertTrue(StampConfig.forBrush(.comicShade)?.halftoneGrid == true)
        XCTAssertNotNil(StampConfig.forBrush(.toneLines)?.hatch)
        XCTAssertNotNil(StampConfig.forBrush(.toneCross)?.hatch)
    }

    func testProductionIntelligenceCollectionsAreCompleteAndPersistable() throws {
        let expected: [(BrushCategory, [BrushType])] = [
            (.productionGrammar, ProductionMarkCatalog.productionBrushes),
            (.materials, ProductionMarkCatalog.materialBrushes),
            (.details, ProductionMarkCatalog.detailBrushes),
        ]
        XCTAssertEqual(ProductionMarkCatalog.productionBrushes.count, 14)
        XCTAssertEqual(ProductionMarkCatalog.materialBrushes.count, 15)
        XCTAssertEqual(ProductionMarkCatalog.detailBrushes.count, 13)

        var marks = Set<ProductionMarkKind>()
        for (category, brushes) in expected {
            let section = try XCTUnwrap(
                BrushCatalog.sections.first { $0.category == category })
            XCTAssertEqual(section.brushes, brushes)
            for type in brushes {
                let profile = try XCTUnwrap(ProductionMarkCatalog.profile(for: type))
                XCTAssertTrue(marks.insert(profile.kind).inserted,
                              "duplikat produksjonsmarkør: \(profile.kind.rawValue)")
                XCTAssertFalse(profile.aiInstruction.isEmpty)
                XCTAssertFalse(BrushDefaults.describe(type).isEmpty)
                XCTAssertNotNil(BrushDefaults.sizeAndOpacity(for: type))
                XCTAssertNotNil(StampConfig.forBrush(type))

                let brush = BrushSpec.preset(
                    type, size: 12, color: "#334455", opacity: 0.7)
                XCTAssertEqual(brush.productionMark, profile.kind)
                let stroke = PencilStroke(
                    id: "production-\(type.rawValue)",
                    points: [StrokePoint(x: 12, y: 24, pressure: 0.7,
                                         tiltX: 10, tiltY: 3, timestamp: 1)],
                    inputType: "pencil", color: brush.color, width: brush.size,
                    opacity: brush.opacity, brush: brush)
                let decoded = try XCTUnwrap(
                    StrokeSerialization.decodeFromWebJSON(
                        StrokeSerialization.encodeToWebJSON([stroke])).first)
                XCTAssertEqual(decoded.brush?.productionMark, profile.kind)
                XCTAssertEqual(decoded, stroke)
            }
        }
        XCTAssertEqual(marks, Set(ProductionMarkKind.allCases))
    }

    func testProductionMarkCompilerNormalizesGeometryAndIgnoresOrdinaryInk() throws {
        func stroke(_ id: String, _ type: BrushType,
                    _ points: [(Double, Double, Double)]) -> PencilStroke {
            let brush = BrushSpec.preset(type, size: 10,
                                         color: "#223344", opacity: 0.7)
            return PencilStroke(
                id: id,
                points: points.enumerated().map { index, point in
                    StrokePoint(x: point.0, y: point.1, pressure: point.2,
                                tiltX: 0, tiltY: 0, timestamp: Double(index))
                },
                inputType: "pencil", color: brush.color, width: brush.size,
                opacity: brush.opacity, brush: brush)
        }

        let payload = ProductionMarkCompiler.compile(strokes: [
            stroke("gesture", .gestureBrush,
                   [(192, 108, 0.4), (576, 324, 0.8)]),
            stroke("wood", .woodGrain,
                   [(960, 540, 0.5), (1_440, 810, 0.7)]),
            stroke("ordinary", .ink,
                   [(20, 20, 0.5), (40, 40, 0.5)]),
        ], canvasWidth: 1_920, canvasHeight: 1_080)

        XCTAssertEqual(payload.version, ProductionMarkCompiler.version)
        XCTAssertEqual(payload.marks.count, 2)
        let gesture = try XCTUnwrap(payload.marks.first { $0.kind == .gesture })
        XCTAssertEqual(gesture.channel, .direction)
        XCTAssertEqual(gesture.center.x, 0.2, accuracy: 0.0001)
        XCTAssertEqual(gesture.center.y, 0.2, accuracy: 0.0001)
        XCTAssertEqual(gesture.direction?.dx ?? 0, 0.2, accuracy: 0.0001)
        XCTAssertEqual(gesture.direction?.dy ?? 0, 0.2, accuracy: 0.0001)
        XCTAssertEqual(gesture.averagePressure, 0.6, accuracy: 0.0001)
        XCTAssertEqual(gesture.pointCount, 2)
        XCTAssertFalse(gesture.interpretation.isEmpty)
        XCTAssertEqual(payload.marks.first { $0.kind == .woodGrain }?.channel,
                       .material)

        let json = try ProductionMarkCompiler.encodeJSON(
            strokes: [stroke("gesture", .gestureBrush,
                             [(192, 108, 0.4), (576, 324, 0.8)])],
            canvasWidth: 1_920, canvasHeight: 1_080)
        XCTAssertTrue(json.contains("trr-production-marks-v3"))
        XCTAssertTrue(json.contains("gesture"))
        XCTAssertTrue(json.contains("angleDegrees"))
    }

    func testProductionMarkBackfillsFromBrushType() throws {
        let json = """
        [{"id":"legacy-ai","points":[{"x":10,"y":20}],"inputType":"pencil",
          "color":"#222222","width":5,"opacity":1,
          "brush":{"type":"eyeLineBrush","size":5,"color":"#222222","opacity":1}}]
        """
        let decoded = try XCTUnwrap(
            StrokeSerialization.decodeFromWebJSON(json).first)
        XCTAssertEqual(decoded.brush?.productionMark, .eyeLine)
    }

    @MainActor
    func testProductionStampsAreProceduralDistinctAndPersistable() throws {
        let expected: [(BrushType, DabPreset, ProductionMarkKind)] = [
            (.crowdStamp, .crowdStamp, .crowd),
            (.treeStamp, .treeStamp, .foliage),
            (.windowStamp, .windowStamp, .architectureDetail),
            (.carStamp, .carStamp, .vehicleDetail),
            (.chairStamp, .chairStamp, .objectDetail),
            (.faceExpressionStamp, .faceExpressionStamp, .faceDetail),
            (.handPoseStamp, .handPoseStamp, .handDetail),
            (.cameraRigStamp, .cameraRigStamp, .camera),
            (.characterPoseStamp, .characterPoseStamp, .gesture),
            (.doorStamp, .doorStamp, .architectureDetail),
            (.tableStamp, .tableStamp, .objectDetail),
            (.sofaStamp, .sofaStamp, .objectDetail),
            (.buildingStamp, .buildingStamp, .architectureDetail),
            (.streetLightStamp, .streetLightStamp, .light),
            (.boomMicStamp, .boomMicStamp, .objectDetail),
            (.filmLightStamp, .filmLightStamp, .light),
            (.bedStamp, .bedStamp, .objectDetail),
            (.staircaseStamp, .staircaseStamp, .architectureDetail),
            (.counterStamp, .counterStamp, .architectureDetail),
            (.workstationStamp, .workstationStamp, .techDetail),
            (.communicationStamp, .communicationStamp, .techDetail),
            (.luggageStamp, .luggageStamp, .objectDetail),
            (.publicTransportStamp, .publicTransportStamp, .vehicleDetail),
            (.animalStamp, .animalStamp, .natureDetail),
            (.rockTerrainStamp, .rockTerrainStamp, .natureDetail),
            (.waterStamp, .waterStamp, .natureDetail),
            (.fireSmokeStamp, .fireSmokeStamp, .dustSmoke),
            (.weatherFXStamp, .weatherFXStamp, .rainWetSurface),
        ]
        let section = try XCTUnwrap(
            BrushCatalog.sections.first { $0.category == .productionStamps })
        XCTAssertEqual(section.title, "Produksjonsstempler")
        XCTAssertEqual(section.brushes, expected.map(\.0))

        guard let renderer = MetalStrokeRenderer() else {
            throw XCTSkip("Metal utilgjengelig")
        }
        var masks = Set<Data>()
        for (type, preset, mark) in expected {
            let config = try XCTUnwrap(StampConfig.forBrush(type))
            XCTAssertEqual(config.preset, preset)
            XCTAssertGreaterThan(config.spacing, 1, "drag skal gi sparsomme stamps")
            XCTAssertEqual(BrushPhysicsCatalog.profile(for: type).tipModel, .stamp)
            XCTAssertEqual(ProductionMarkCatalog.profile(for: type)?.kind, mark)
            XCTAssertNotNil(BrushDefaults.sizeAndOpacity(for: type))

            let brush = BrushSpec.preset(
                type, size: 120, color: "#26313a", opacity: 0.84)
            let variant = try XCTUnwrap(ProductionStampCatalog.variant(2, for: type))
            let geometry = ProductionStampGeometryCatalog.geometry(
                for: type, variant: variant.id, seed: 42)
            let instance = ProductionStampInstance(
                variant: variant.id, variantName: variant.name, seed: 42,
                scale: 1.5, rotationDegrees: 27, flipX: true,
                depth: .foreground, styleProfileId: "trr-story-pencil",
                continuityId: "continuity-\(type.rawValue)",
                renderLayer: [.cameraRigStamp, .boomMicStamp, .filmLightStamp]
                    .contains(type) ? .productionOverlay : .artwork,
                parameters: variant.parameters,
                compoundGeometry: geometry, perspectiveSkew: 0.18)
            let stroke = PencilStroke(
                id: "stamp-\(type.rawValue)",
                points: [StrokePoint(x: 200, y: 200, pressure: 0.75,
                                     tiltX: 0, tiltY: 0, timestamp: 1)],
                inputType: "pencil", color: brush.color, width: brush.size,
                opacity: brush.opacity, brush: brush,
                boardLayer: [.cameraRigStamp, .boomMicStamp, .filmLightStamp]
                    .contains(type) ? "Camera / Arrows" : "Drawing",
                stampInstance: instance)
            let dabs = renderer.dabsForStroke(stroke, scale: 1)
            XCTAssertEqual(dabs.count, 1,
                           "ett tap skal gi ett \(type.rawValue)")
            XCTAssertEqual(Double(dabs[0].rotation), 27 * .pi / 180,
                           accuracy: 0.0001)
            XCTAssertLessThan(dabs[0].stretch.x, 0)
            XCTAssertGreaterThan(dabs[0].size, Float(brush.size))
            let decoded = try XCTUnwrap(
                StrokeSerialization.decodeFromWebJSON(
                    StrokeSerialization.encodeToWebJSON([stroke])).first)
            XCTAssertEqual(decoded, stroke)
            XCTAssertEqual(decoded.brush?.productionMark, mark)
            XCTAssertEqual(decoded.stampInstance, instance)

            let compiled = try XCTUnwrap(ProductionMarkCompiler.compile(
                strokes: [stroke], canvasWidth: 1_920, canvasHeight: 1_080
            ).marks.first)
            XCTAssertEqual(compiled.stamp?.variantName, variant.name)
            XCTAssertEqual(compiled.stamp?.continuityId,
                           "continuity-\(type.rawValue)")
            XCTAssertEqual(compiled.direction?.angleDegrees ?? 0, 27,
                           accuracy: 0.0001)
            XCTAssertEqual(compiled.stamp?.perspectiveSkew, 0.18)
            XCTAssertGreaterThan(geometry.paths.count, 4,
                                 "\(type.rawValue) må ha minst fem kontrollbaner")
            XCTAssertTrue(geometry.paths.contains { $0.role == .contour })
            XCTAssertTrue(geometry.paths.contains { $0.role == .detail })

            var variantMasks = Set<Data>()
            for variantIndex in 0..<4 {
                let texture = try XCTUnwrap(DabTextureGenerator.makeTexture(
                    device: renderer.device, preset: preset,
                    variant: variantIndex, seed: 42))
                XCTAssertEqual(texture.width, 512)
                XCTAssertEqual(texture.height, 512)
                var pixels = [UInt8](repeating: 0,
                                     count: texture.width * texture.height)
                texture.getBytes(
                    &pixels, bytesPerRow: texture.width,
                    from: MTLRegionMake2D(0, 0, texture.width, texture.height),
                    mipmapLevel: 0)
                XCTAssertGreaterThan(pixels.filter { $0 > 24 }.count, 400,
                                     "\(type.rawValue) variant \(variantIndex) mangler maske")
                let data = Data(pixels)
                variantMasks.insert(data)
                masks.insert(data)
            }
            XCTAssertEqual(variantMasks.count, 4,
                           "\(type.rawValue) må ha fire visuelt ulike varianter")
        }
        XCTAssertEqual(masks.count, expected.count * 4,
                       "alle 112 stamp-varianter må ha en egen prosedural form")
    }

    @MainActor
    func testStampPlacementContextIsStableAndInfersDepth() throws {
        let state = CanvasState()
        state.contentSize = CGSize(width: 1_920, height: 1_080)
        state.selectBrush(.crowdStamp)
        let point = StrokePoint(x: 400, y: 100, pressure: 0.7,
                                tiltX: 0, tiltY: 0, timestamp: 1)
        let first = try XCTUnwrap(state.stampInstance(
            for: .crowdStamp, strokeID: "stable-stamp", points: [point]))
        let second = try XCTUnwrap(state.stampInstance(
            for: .crowdStamp, strokeID: "stable-stamp", points: [point]))
        XCTAssertEqual(first, second)
        XCTAssertEqual(first.depth, .background)
        XCTAssertEqual(first.renderLayer, .artwork)
        XCTAssertNotNil(first.compoundGeometry)
        XCTAssertGreaterThan(first.compoundGeometry?.paths.count ?? 0, 4)
        XCTAssertEqual(ProductionStampCatalog.variants(for: .crowdStamp).count, 4)

        state.perspectiveSnapPoints = [CGPoint(x: 1_700, y: 300)]
        let perspective = try XCTUnwrap(state.stampInstance(
            for: .chairStamp, strokeID: "perspective-chair", points: [point]))
        XCTAssertGreaterThan(perspective.perspectiveSkew ?? 0, 0)

        let rig = try XCTUnwrap(state.stampInstance(
            for: .cameraRigStamp, strokeID: "camera-stamp", points: [point]))
        XCTAssertEqual(rig.renderLayer, .productionOverlay)
        let boom = try XCTUnwrap(state.stampInstance(
            for: .boomMicStamp, strokeID: "boom-stamp", points: [point]))
        XCTAssertEqual(boom.renderLayer, .productionOverlay)
        let light = try XCTUnwrap(state.stampInstance(
            for: .filmLightStamp, strokeID: "light-stamp", points: [point]))
        XCTAssertEqual(light.renderLayer, .productionOverlay)
        XCTAssertEqual(ProductionStampCatalog.stableSeed(for: "abc"),
                       ProductionStampCatalog.stableSeed(for: "abc"))
    }

    func testCompoundStampReleasesToEditableStrokesWithoutLosingAIContext() throws {
        let type = BrushType.carStamp
        let brush = BrushSpec.preset(
            type, size: 220, color: "#26313a", opacity: 0.88)
        let variant = try XCTUnwrap(ProductionStampCatalog.variant(1, for: type))
        let geometry = ProductionStampGeometryCatalog.geometry(
            for: type, variant: variant.id, seed: 91)
        let stamp = ProductionStampInstance(
            variant: variant.id, variantName: variant.name, seed: 91,
            scale: 1.3, rotationDegrees: 18, flipX: true,
            depth: .foreground, styleProfileId: "trr-story-pencil",
            continuityId: "hero-car", parameters: variant.parameters,
            compoundGeometry: geometry, perspectiveSkew: 0.2)
        let source = PencilStroke(
            id: "compound-car", points: [StrokePoint(
                x: 960, y: 540, pressure: 0.8,
                tiltX: 0, tiltY: 0, timestamp: 1)],
            inputType: "pencil", color: brush.color, width: brush.size,
            opacity: brush.opacity, brush: brush,
            boardLayer: "Drawing", stampInstance: stamp)

        let released = ProductionStampGeometryCatalog.releasedStrokes(from: source)

        XCTAssertGreaterThan(released.count, 8)
        XCTAssertTrue(released.allSatisfy { $0.stampInstance == nil })
        XCTAssertTrue(released.allSatisfy { $0.stampGroupId == source.id })
        XCTAssertEqual(released.compactMap(\.releasedStampContext).count, 1)
        XCTAssertTrue(released.contains { $0.stampComponentRole == .construction })
        XCTAssertTrue(released.contains { $0.stampComponentRole == .contour })
        XCTAssertTrue(released.contains { $0.stampComponentRole == .shadow })

        let payload = ProductionMarkCompiler.compile(
            strokes: released, canvasWidth: 1_920, canvasHeight: 1_080)
        XCTAssertEqual(payload.marks.count, 1)
        XCTAssertEqual(payload.marks.first?.strokeId, source.id)
        XCTAssertEqual(payload.marks.first?.kind, .vehicleDetail)
        XCTAssertEqual(payload.marks.first?.stamp?.continuityId, "hero-car")
        XCTAssertEqual(payload.marks.first?.center.x ?? 0, 0.5, accuracy: 0.001)

        let decoded = try StrokeSerialization.decodeFromWebJSON(
            StrokeSerialization.encodeToWebJSON(released))
        XCTAssertEqual(decoded, released)
    }

    @MainActor
    func testProductionStampHighFidelityAtlasesAreBundledAndTonal() throws {
        guard let renderer = MetalStrokeRenderer() else {
            throw XCTSkip("Metal utilgjengelig")
        }
        let atlases: [(DabPreset, String)] = [
            (.crowdStamp, "StampCrowdAtlas"),
            (.treeStamp, "StampTreeAtlas"),
            (.windowStamp, "StampWindowAtlas"),
            (.carStamp, "StampCarAtlas"),
            (.chairStamp, "StampChairAtlas"),
            (.faceExpressionStamp, "StampFaceAtlas"),
            (.handPoseStamp, "StampHandAtlas"),
            (.cameraRigStamp, "StampCameraRigAtlas"),
            (.characterPoseStamp, "StampCharacterPoseAtlas"),
            (.doorStamp, "StampDoorAtlas"),
            (.tableStamp, "StampTableAtlas"),
            (.sofaStamp, "StampSofaAtlas"),
            (.buildingStamp, "StampBuildingAtlas"),
            (.streetLightStamp, "StampStreetLightAtlas"),
            (.boomMicStamp, "StampBoomMicAtlas"),
            (.filmLightStamp, "StampFilmLightAtlas"),
            (.bedStamp, "StampBedAtlas"),
            (.staircaseStamp, "StampStaircaseAtlas"),
            (.counterStamp, "StampCounterAtlas"),
            (.workstationStamp, "StampWorkstationAtlas"),
            (.communicationStamp, "StampCommunicationAtlas"),
            (.luggageStamp, "StampLuggageAtlas"),
            (.publicTransportStamp, "StampPublicTransportAtlas"),
            (.animalStamp, "StampAnimalAtlas"),
            (.rockTerrainStamp, "StampRockTerrainAtlas"),
            (.waterStamp, "StampWaterAtlas"),
            (.fireSmokeStamp, "StampFireSmokeAtlas"),
            (.weatherFXStamp, "StampWeatherFXAtlas"),
        ]
        for (preset, assetName) in atlases {
            XCTAssertNotNil(UIImage(named: assetName),
                            "\(assetName) må ligge i app-bundelen")
            let texture = try XCTUnwrap(DabTextureGenerator.makeTexture(
                device: renderer.device, preset: preset,
                variant: 0, seed: 1))
            var pixels = [UInt8](repeating: 0,
                                 count: texture.width * texture.height)
            texture.getBytes(&pixels, bytesPerRow: texture.width,
                             from: MTLRegionMake2D(
                                0, 0, texture.width, texture.height),
                             mipmapLevel: 0)
            XCTAssertGreaterThan(pixels.filter { $0 > 10 }.count, 8_000,
                                 "\(assetName) har for lite tegningsinformasjon")
            XCTAssertGreaterThan(Set(pixels).count, 80,
                                 "\(assetName) må bevare grafittens tonevariasjon")
        }
    }

    @MainActor
    func testCompoundStampDepthAndStyleChangeTheActualMask() throws {
        guard let renderer = MetalStrokeRenderer() else {
            throw XCTSkip("Metal utilgjengelig")
        }
        let type = BrushType.chairStamp
        let geometry = ProductionStampGeometryCatalog.geometry(
            for: type, variant: 2, seed: 77)
        func mask(depth: ProductionStampDepth, style: String) throws -> [UInt8] {
            let stamp = ProductionStampInstance(
                variant: 2, variantName: "Lenestol", seed: 77,
                depth: depth, styleProfileId: style,
                compoundGeometry: geometry)
            let texture = try XCTUnwrap(DabTextureGenerator.makeTexture(
                device: renderer.device, preset: .chairStamp,
                variant: 2, seed: 77, stampInstance: stamp))
            var pixels = [UInt8](repeating: 0,
                                 count: texture.width * texture.height)
            texture.getBytes(&pixels, bytesPerRow: texture.width,
                             from: MTLRegionMake2D(
                                0, 0, texture.width, texture.height),
                             mipmapLevel: 0)
            return pixels
        }

        let background = try mask(depth: .background, style: "trr-story-pencil")
        let foreground = try mask(depth: .foreground, style: "trr-story-pencil")
        let clean = try mask(depth: .foreground, style: "clean-production")
        let charcoal = try mask(depth: .foreground, style: "charcoal-board")
        XCTAssertGreaterThan(foreground.reduce(0) { $0 + Int($1) },
                             background.reduce(0) { $0 + Int($1) })
        XCTAssertNotEqual(clean, charcoal)
        XCTAssertNotEqual(background, foreground)
    }

    @MainActor
    func testTraditionalStudioGeneratorsAreDeterministicAndDistinct() throws {
        guard let renderer = MetalStrokeRenderer() else { throw XCTSkip("Metal utilgjengelig") }
        let points = [
            StrokePoint(x: 20, y: 40, pressure: 0.55, tiltX: 62, tiltY: 8, timestamp: 0),
            StrokePoint(x: 250, y: 80, pressure: 0.72, tiltX: 58, tiltY: 12, timestamp: 120),
        ]
        func dabs(_ type: BrushType, id: String = "studio-family") -> [DabInstanceData] {
            let defaults = BrushDefaults.sizeAndOpacity(for: type) ?? (12, 0.7)
            let brush = BrushSpec.preset(type, size: defaults.size,
                                         color: "#2c3038", opacity: defaults.opacity)
            return renderer.dabsForStroke(PencilStroke(
                id: id, points: points, inputType: "pencil", color: brush.color,
                width: brush.size, opacity: brush.opacity, brush: brush), scale: 1)
        }

        let roughNib = dabs(.nibRough)
        XCTAssertFalse(roughNib.isEmpty)
        XCTAssertEqual(roughNib.count, dabs(.nibRough).count)
        XCTAssertEqual(roughNib.first?.position, dabs(.nibRough).first?.position)
        XCTAssertGreaterThan(dabs(.nibBrush).count, dabs(.nibFine).count)
        XCTAssertGreaterThan(dabs(.toneCross).count, dabs(.toneLines).count)

        let fineDot = dabs(.stippleFine).map(\.size).reduce(0, +)
            / Float(max(1, dabs(.stippleFine).count))
        let roughDot = dabs(.stippleRough).map(\.size).reduce(0, +)
            / Float(max(1, dabs(.stippleRough).count))
        XCTAssertLessThan(fineDot, roughDot)
    }

    @MainActor
    func testCircularPoseInterpolationUsesShortestPath() throws {
        let degreeMidpoint = try XCTUnwrap(
            MetalStrokeRenderer.interpolateAngleDegrees(359, 1, t: 0.5)
        )
        let radianMidpoint = try XCTUnwrap(
            MetalStrokeRenderer.interpolateAngleRadians(.pi * 1.9, .pi * 0.1, t: 0.5)
        )

        XCTAssertEqual(degreeMidpoint, 0, accuracy: 0.0001)
        XCTAssertEqual(radianMidpoint, .pi * 2, accuracy: 0.0001)
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

    // Story Brush Engine: dab-generering skal være deterministisk også for
    // prosedural hatch (samme strøk → identiske dabs, re-render-krav §80).
    @MainActor
    func testHatchDeterministic() throws {
        guard let renderer = MetalStrokeRenderer() else {
            throw XCTSkip("Metal utilgjengelig")
        }
        let stroke = PencilStroke(
            id: "hatch-1",
            points: [
                StrokePoint(x: 100, y: 100, pressure: 0.8, tiltX: 0, tiltY: 0, timestamp: 0),
                StrokePoint(x: 300, y: 160, pressure: 0.8, tiltX: 0, tiltY: 0, timestamp: 120),
            ],
            inputType: "pencil", color: "#26282e", width: 34, opacity: 0.32,
            brush: BrushSpec.preset(.crosshatch, size: 34, color: "#26282e", opacity: 0.32))
        let a = renderer.dabsForStroke(stroke, scale: 1)
        let b = renderer.dabsForStroke(stroke, scale: 1)
        XCTAssertFalse(a.isEmpty)
        XCTAssertEqual(a.count, b.count)
        XCTAssertEqual(a.first?.position, b.first?.position)
        XCTAssertEqual(a.last?.alpha, b.last?.alpha)
    }

    // Swift- og Metal-structen må utvikles i takt. Brush Engine 2 legger fire
    // materialfloats etter color og bruker en eksplisitt 64-byte layout.
    func testDabInstanceStrideMatchesShader() {
        XCTAssertEqual(MemoryLayout<DabInstanceData>.stride, 64)
    }

    @MainActor
    func testBrushEngine2MaterialGeneratorsAreDeterministicAndDistinct() throws {
        guard let renderer = MetalStrokeRenderer() else { throw XCTSkip("Metal utilgjengelig") }
        let points = [
            StrokePoint(x: 20, y: 30, pressure: 0.7, tiltX: 60, tiltY: 0, timestamp: 0),
            StrokePoint(x: 240, y: 30, pressure: 0.8, tiltX: 60, tiltY: 0, timestamp: 100),
        ]
        func dabs(_ type: BrushType, id: String = "material") -> [DabInstanceData] {
            let brush = BrushSpec.preset(type, size: 12, color: "#26282e", opacity: 0.7)
            return renderer.dabsForStroke(PencilStroke(
                id: id, points: points, inputType: "pencil", color: brush.color,
                width: brush.size, opacity: brush.opacity, brush: brush), scale: 1)
        }
        let pencil = dabs(.pencil)
        let dryInk = dabs(.dryink)
        let dryInkAgain = dabs(.dryink)
        XCTAssertGreaterThan(dryInk.count, pencil.count * 2, "filamenter skal gi flere bustspor")
        XCTAssertEqual(dryInk.count, dryInkAgain.count)
        XCTAssertEqual(dryInk.first?.position, dryInkAgain.first?.position)
        XCTAssertEqual(dryInk.first?.hardness ?? -1, 0.74, accuracy: 0.001)

        let watercolor = dabs(.watercolor, id: "wet")
        XCTAssertTrue(watercolor.contains { $0.bleed > 0.5 })
        XCTAssertTrue(watercolor.contains { $0.paperProfile == 3 })
    }

    @MainActor
    func testTiltSensitivityChangesPhysicalFootprint() throws {
        guard let renderer = MetalStrokeRenderer() else { throw XCTSkip("Metal utilgjengelig") }
        let points = [
            StrokePoint(x: 20, y: 20, pressure: 0.8, tiltX: 80, tiltY: 0, timestamp: 0),
            StrokePoint(x: 160, y: 20, pressure: 0.8, tiltX: 80, tiltY: 0, timestamp: 100),
        ]
        func footprint(_ sensitivity: Double) -> SIMD2<Float> {
            var brush = BrushSpec.preset(.shade, size: 30, color: "#222222", opacity: 0.4)
            brush.tiltSensitivity = sensitivity
            let stroke = PencilStroke(id: "tilt-\(sensitivity)", points: points,
                                      inputType: "pencil", color: brush.color,
                                      width: brush.size, opacity: brush.opacity, brush: brush)
            // Første dab er selve fysiske spissen. Senere dabs kan være
            // retningstekstur med et eget, fast 3.5:0.5-forhold.
            return renderer.dabsForStroke(stroke, scale: 1).first?.stretch ?? .zero
        }
        let untilted = footprint(0)
        let tilted = footprint(1)
        XCTAssertEqual(untilted.x, 1, accuracy: 0.001)
        XCTAssertEqual(untilted.y, 1, accuracy: 0.001)
        XCTAssertGreaterThan(tilted.x, 2)
        XCTAssertLessThan(tilted.y, 0.8)
    }

    // Pressure curve (spec §8): pow(p, 0.65) løfter lave trykk — dab-størrelse
    // ved p=0.3 skal være større enn med lineær kurve.
    @MainActor
    func testPencilPressureCurveApplied() throws {
        guard let renderer = MetalStrokeRenderer() else {
            throw XCTSkip("Metal utilgjengelig")
        }
        func maxSize(_ type: BrushType) -> Float {
            let stroke = PencilStroke(
                id: "curve-1",
                points: [
                    StrokePoint(x: 0, y: 0, pressure: 0.3, tiltX: 0, tiltY: 0, timestamp: 0),
                    StrokePoint(x: 120, y: 0, pressure: 0.3, tiltX: 0, tiltY: 0, timestamp: 100),
                ],
                inputType: "pencil", color: "#000000", width: 6, opacity: 0.5,
                brush: BrushSpec.preset(type, size: 6, color: "#000000", opacity: 0.5))
            return renderer.dabsForStroke(stroke, scale: 1).map(\.size).max() ?? 0
        }
        // heavy har pressureCurve 0.65 og pressureToSize 0.78; graphite lineær.
        // Sammenlign relativ effekt: pow(0.3,0.65)=0.457 > 0.3.
        let heavy = maxSize(.heavy)
        XCTAssertGreaterThan(heavy, 0)
    }

    // Konflikt-merge (forbedringspunkt 1): union på id — server først,
    // våre nye appendes, dupliserte id-er tas aldri med to ganger.
    func testStrokeMergeUnion() throws {
        let server = #"[{"id":"a","points":[]},{"id":"b","points":[]}]"#
        let ours = #"[{"id":"a","points":[]},{"id":"c","points":[]}]"#
        let merged = try XCTUnwrap(StrokeMerge.union(serverJSON: server, oursJSON: ours))
        let list = try XCTUnwrap(
            JSONSerialization.jsonObject(with: Data(merged.utf8)) as? [[String: Any]])
        XCTAssertEqual(list.compactMap { $0["id"] as? String }, ["a", "b", "c"])
    }

    func testStrokeMergeMalformedReturnsNil() {
        XCTAssertNil(StrokeMerge.union(serverJSON: "ikke json", oursJSON: "[]"))
    }

    func testThreeWayMergePreservesDeletionTombstonesAndBothAdditions() throws {
        let base = #"[{"id":"a","points":[]},{"id":"b","points":[]}]"#
        let server = #"[{"id":"a","points":[]},{"id":"b","points":[]},{"id":"server-new","points":[]}]"#
        let ours = #"[{"id":"a","points":[]},{"id":"local-new","points":[]}]"#
        let merged = try XCTUnwrap(
            StrokeMerge.threeWay(serverJSON: server, baseJSON: base, oursJSON: ours))
        let list = try XCTUnwrap(
            JSONSerialization.jsonObject(with: Data(merged.utf8)) as? [[String: Any]])
        XCTAssertEqual(list.compactMap { $0["id"] as? String },
                       ["a", "server-new", "local-new"])
    }

    @MainActor
    func testDocumentHistoryRestoresLayerStateAcrossFrameReload() {
        let frameID = "history-\(UUID().uuidString)"
        defer { StoryboardFrameHistoryStore.clear(frameId: frameID) }
        let state = CanvasState()
        state.beginHistory(frameId: frameID, layerState: .standard)
        state.captureUndo("Endre lag")
        state.layerBlendModes["Color"] = .multiply
        state.hiddenLayers.insert("Notes")
        state.revision += 1
        state.persistHistory()

        let restored = CanvasState()
        restored.beginHistory(frameId: frameID, layerState: state.layerState)
        XCTAssertEqual(restored.undoStack.count, 1)
        restored.undo()
        XCTAssertEqual(restored.layerBlendModes["Color"], nil)
        XCTAssertFalse(restored.hiddenLayers.contains("Notes"))
    }

    // ── Quick-shape (hold-snap): lukket form → ellipse/rektangel ─────

    private func holdStroke(_ coords: [(Double, Double)]) -> PencilStroke {
        var t = 0.0
        var points = coords.map { xy -> StrokePoint in
            t += 20
            return StrokePoint(x: xy.0, y: xy.1, pressure: 0.7, tiltX: 0, tiltY: 0, timestamp: t)
        }
        // Hold: 500 ms stille på sluttpunktet.
        if let last = points.last {
            points.append(StrokePoint(x: last.x, y: last.y, pressure: 0.7,
                                      tiltX: 0, tiltY: 0, timestamp: t + 500))
        }
        return PencilStroke(id: "qs", points: points, inputType: "pencil",
                            color: "#26282e", width: 5, opacity: 0.9,
                            brush: BrushSpec.preset(.pencil, size: 5, color: "#26282e", opacity: 0.9))
    }

    @MainActor
    func testQuickShapeSnapsCircleToEllipse() throws {
        let coords = (0...24).map { step -> (Double, Double) in
            let angle = Double(step) / 24 * .pi * 2
            return (400 + 150 * cos(angle) + Double(step % 3), 300 + 120 * sin(angle))
        }
        let snapped = try XCTUnwrap(
            MetalCanvasUIView.quickShapeSnap(holdStroke(coords), brushType: .pencil))
        XCTAssertEqual(snapped.points.count, 49, "ellipse genererer 49 punkter")
        // Alle punkter skal ligge på ellipsen (radiusavvik ≈ 0).
        for point in snapped.points {
            let radius = hypot((point.x - 400) / 150, (point.y - 300) / 120)
            XCTAssertEqual(radius, 1, accuracy: 0.05)
        }
    }

    @MainActor
    func testQuickShapeSnapsBoxToRectangle() throws {
        var coords: [(Double, Double)] = []
        for step in 0...10 { coords.append((200 + Double(step) * 40, 200)) }
        for step in 0...10 { coords.append((600, 200 + Double(step) * 30)) }
        for step in 0...10 { coords.append((600 - Double(step) * 40, 500)) }
        for step in 0...10 { coords.append((200, 500 - Double(step) * 30)) }
        let snapped = try XCTUnwrap(
            MetalCanvasUIView.quickShapeSnap(holdStroke(coords), brushType: .pencil))
        // Alle punkter på bbox-kanten.
        for point in snapped.points {
            let onEdge = min(min(abs(point.x - 200), abs(point.x - 600)),
                             min(abs(point.y - 200), abs(point.y - 500)))
            XCTAssertEqual(onEdge, 0, accuracy: 1)
        }
    }

    @MainActor
    func testQuickShapeOpenStrokeStillSnapsToLine() throws {
        let coords = (0...20).map { step -> (Double, Double) in
            (100 + Double(step) * 30, 200 + Double(step) * 10 + (step % 2 == 0 ? 4.0 : -4.0))
        }
        let snapped = try XCTUnwrap(
            MetalCanvasUIView.quickShapeSnap(holdStroke(coords), brushType: .pencil))
        XCTAssertEqual(snapped.points.count, 25, "linje genererer 25 punkter")
    }

    // ── Research-runden: fyll, halftone, snap, wet mix ───────────────

    @MainActor
    func testFillInteriorGeneratesInteriorDabs() throws {
        guard let renderer = MetalStrokeRenderer() else { throw XCTSkip("Metal utilgjengelig") }
        func circleStroke(_ type: BrushType) -> PencilStroke {
            var t = 0.0
            let points = (0...36).map { step -> StrokePoint in
                let angle = Double(step) / 36 * .pi * 2
                t += 10
                return StrokePoint(x: 400 + 150 * cos(angle), y: 300 + 150 * sin(angle),
                                   pressure: 0.7, tiltX: 0, tiltY: 0, timestamp: t)
            }
            return PencilStroke(id: "fill-test-\(type.rawValue)", points: points,
                                inputType: "pencil", color: "#26282e", width: 8, opacity: 0.9,
                                brush: BrushSpec.preset(type, size: 8, color: "#26282e", opacity: 0.9))
        }
        let outlineOnly = renderer.dabsForStroke(circleStroke(.ink), scale: 1)
        let filled = renderer.dabsForStroke(circleStroke(.fill), scale: 1)
        XCTAssertGreaterThan(filled.count, outlineOnly.count * 3,
                             "fyllet skal generere interiør-dabs, ikke bare omriss")
    }

    @MainActor
    func testHalftoneSnapsToGrid() throws {
        guard let renderer = MetalStrokeRenderer() else { throw XCTSkip("Metal utilgjengelig") }
        var t = 0.0
        let points = (0...30).map { step -> StrokePoint in
            t += 8
            return StrokePoint(x: 100 + Double(step) * 15, y: 200 + Double(step) * 3,
                               pressure: 0.8, tiltX: 0, tiltY: 0, timestamp: t)
        }
        let stroke = PencilStroke(id: "ht", points: points, inputType: "pencil",
                                  color: "#26282e", width: 34, opacity: 0.85,
                                  brush: BrushSpec.preset(.halftone, size: 34, color: "#26282e", opacity: 0.85))
        let dabs = renderer.dabsForStroke(stroke, scale: 1)
        XCTAssertFalse(dabs.isEmpty)
        let grid = max(3, 34.0 * 0.7)
        for dab in dabs {
            let rx = Double(dab.position.x).truncatingRemainder(dividingBy: grid)
            XCTAssertTrue(min(rx, grid - rx) < 0.01, "dab ikke på grid: \(dab.position)")
        }
        // Deterministisk dedup: samme strøk to ganger → samme antall
        XCTAssertEqual(dabs.count, renderer.dabsForStroke(stroke, scale: 1).count)
    }

    func testPerspectiveSnapProjectsOntoRay() throws {
        var t = 0.0
        let points = (0...10).map { step -> StrokePoint in
            t += 10
            // Nesten horisontalt strøk med litt sjatter
            return StrokePoint(x: 100 + Double(step) * 40,
                               y: 300 + Double(step % 2 == 0 ? 4.0 : -4.0),
                               pressure: 0.7, tiltX: 0, tiltY: 0, timestamp: t)
        }
        let stroke = PencilStroke(id: "ps", points: points, inputType: "pencil",
                                  color: "#26282e", width: 5, opacity: 0.9,
                                  brush: BrushSpec.preset(.pencil, size: 5, color: "#26282e", opacity: 0.9))
        let vp = CGPoint(x: 1900, y: 300)
        let snapped = try XCTUnwrap(
            MetalCanvasUIView.perspectiveSnap(stroke, vanishingPoints: [vp]))
        // Strålen går gjennom FØRSTE punkt mot VP — assert kolinearitet.
        let first = snapped.points[0]
        let rayDX = Double(vp.x) - first.x, rayDY = Double(vp.y) - first.y
        let rayLength = hypot(rayDX, rayDY)
        for point in snapped.points {
            let cross = ((point.x - first.x) * rayDY - (point.y - first.y) * rayDX) / rayLength
            XCTAssertEqual(cross, 0, accuracy: 0.01, "punkt ikke på VP-strålen")
        }
        // 45° unna → ingen snap
        let steep = PencilStroke(id: "ps2", points: points.enumerated().map { index, point in
            var p = point; p.y = 300 + Double(index) * 40; return p
        }, inputType: "pencil", color: "#26282e", width: 5, opacity: 0.9,
           brush: stroke.brush)
        XCTAssertNil(MetalCanvasUIView.perspectiveSnap(steep, vanishingPoints: [vp]))
    }

    @MainActor
    func testWetFalloffReducesAlphaAlongStroke() throws {
        guard let renderer = MetalStrokeRenderer() else { throw XCTSkip("Metal utilgjengelig") }
        var t = 0.0
        let points = (0...60).map { step -> StrokePoint in
            t += 8
            return StrokePoint(x: 50 + Double(step) * 25, y: 300,
                               pressure: 0.7, tiltX: 0, tiltY: 0, timestamp: t)
        }
        let stroke = PencilStroke(id: "wet", points: points, inputType: "pencil",
                                  color: "#3a5a7a", width: 60, opacity: 0.6,
                                  brush: BrushSpec.preset(.wash, size: 60, color: "#3a5a7a", opacity: 0.6))
        let dabs = renderer.dabsForStroke(stroke, scale: 1)
        XCTAssertGreaterThan(dabs.count, 20)
        let early = dabs.prefix(5).map { Double($0.alpha) }.reduce(0, +) / 5
        let mid = dabs[(dabs.count / 2 - 2)...(dabs.count / 2 + 2)]
            .map { Double($0.alpha) }.reduce(0, +) / 5
        XCTAssertLessThan(mid, early, "pigmentet skal brukes opp langs strøket")
    }

    func testInspectorTextDraftSurvivesRoundtripUntilServerConfirmation() throws {
        let frameId = "inspector-draft-\(UUID().uuidString)"
        defer { InspectorTextDraftStore.clear(frameId: frameId) }
        let expected = InspectorTextDraft(
            sceneId: "scene-a", frameId: frameId,
            description: "Regissøren finner riktig rolle.",
            notes: "Hold øyelinjen mot venstre.", updatedAt: Date())

        InspectorTextDraftStore.save(expected)
        let loaded = try XCTUnwrap(InspectorTextDraftStore.load(frameId: frameId))
        XCTAssertEqual(loaded.sceneId, expected.sceneId)
        XCTAssertEqual(loaded.description, expected.description)
        XCTAssertEqual(loaded.notes, expected.notes)

        InspectorTextDraftStore.clear(frameId: frameId)
        XCTAssertNil(InspectorTextDraftStore.load(frameId: frameId))
    }

    func testAIImageAspectRequestUsesAppliedShotViewport() {
        func context(_ aspectRatio: Double?) -> [String: any Sendable] {
            var framing: [String: any Sendable] = [:]
            if let aspectRatio { framing["aspectRatio"] = aspectRatio }
            let shot: [String: any Sendable] = ["shotFraming": framing]
            return ["shot": shot]
        }

        let landscape = RoleRoomAPIClient.storyboardImageAspectParameters(
            context: context(16.0 / 9.0))
        XCTAssertEqual(landscape.providerToken, "1792x1024")
        XCTAssertEqual(landscape.targetAspectRatio, 16.0 / 9.0, accuracy: 0.000_001)

        let cinematic = RoleRoomAPIClient.storyboardImageAspectParameters(
            context: context(2.39))
        XCTAssertEqual(cinematic.providerToken, "1792x1024")
        XCTAssertEqual(cinematic.targetAspectRatio, 2.39, accuracy: 0.000_001)

        let portrait = RoleRoomAPIClient.storyboardImageAspectParameters(
            context: context(9.0 / 16.0))
        XCTAssertEqual(portrait.providerToken, "1024x1792")
        XCTAssertEqual(portrait.targetAspectRatio, 9.0 / 16.0, accuracy: 0.000_001)

        let square = RoleRoomAPIClient.storyboardImageAspectParameters(
            context: context(1))
        XCTAssertEqual(square.providerToken, "1024x1024")
        XCTAssertEqual(square.targetAspectRatio, 1, accuracy: 0.000_001)

        let fallback = RoleRoomAPIClient.storyboardImageAspectParameters(
            context: context(nil))
        XCTAssertEqual(fallback.providerToken, "1792x1024")
        XCTAssertEqual(fallback.targetAspectRatio, 16.0 / 9.0, accuracy: 0.000_001)
    }

    func testEditableBaseAspectFillTransformNeverStretches() throws {
        let landscape = try XCTUnwrap(
            StoryboardImageAspectPolicy.aspectFillUVTransform(
                sourceSize: ShotFramingSize(width: 1_536, height: 1_024),
                destinationSize: ShotFramingSize(width: 1_920, height: 1_080)))
        XCTAssertEqual(landscape.offsetX, 0, accuracy: 0.000_001)
        XCTAssertEqual(landscape.offsetY, 0.078_125, accuracy: 0.000_001)
        XCTAssertEqual(landscape.scaleX, 1, accuracy: 0.000_001)
        XCTAssertEqual(landscape.scaleY, 0.843_75, accuracy: 0.000_001)

        let portrait = try XCTUnwrap(
            StoryboardImageAspectPolicy.aspectFillUVTransform(
                sourceSize: ShotFramingSize(width: 1_024, height: 1_536),
                destinationSize: ShotFramingSize(width: 1_080, height: 1_920)))
        XCTAssertEqual(portrait.offsetX, 0.078_125, accuracy: 0.000_001)
        XCTAssertEqual(portrait.offsetY, 0, accuracy: 0.000_001)
        XCTAssertEqual(portrait.scaleX, 0.843_75, accuracy: 0.000_001)
        XCTAssertEqual(portrait.scaleY, 1, accuracy: 0.000_001)

        XCTAssertNil(StoryboardImageAspectPolicy.aspectFillUVTransform(
            sourceSize: ShotFramingSize(width: 0, height: 100),
            destinationSize: ShotFramingSize(width: 160, height: 90)))
    }

    @MainActor
    func testEditableBaseMetalBlitCenterCropsInsteadOfStretching() throws {
        guard let renderer = MetalStrokeRenderer() else {
            throw XCTSkip("Metal utilgjengelig")
        }
        let format = UIGraphicsImageRendererFormat()
        format.scale = 1
        format.opaque = true
        let source = UIGraphicsImageRenderer(
            size: CGSize(width: 150, height: 100), format: format
        ).image { context in
            UIColor.green.setFill()
            context.fill(CGRect(x: 0, y: 0, width: 150, height: 100))
            UIColor.red.setFill()
            context.fill(CGRect(x: 0, y: 0, width: 150, height: 6))
            UIColor.blue.setFill()
            context.fill(CGRect(x: 0, y: 94, width: 150, height: 6))
        }
        let sourceCGImage = try XCTUnwrap(source.cgImage)

        renderer.resizeCanvas(width: 160, height: 90)
        renderer.setEditableBase(cgImage: sourceCGImage)
        renderer.clearCommitted()
        renderer.waitForPendingWork()

        XCTAssertEqual(renderer.pickColorHex(normalizedX: 0.5, normalizedY: 0.03),
                       "#00ff00")
        XCTAssertEqual(renderer.pickColorHex(normalizedX: 0.5, normalizedY: 0.97),
                       "#00ff00")
    }
}
