import XCTest
@testable import StoryboardStudio

// Praksis-test av Story Brush Engine: komponerer en storyboard-scene i
// referansens ånd (monster over bygate, soldater, vrak, skravert himmel)
// som ekte strokes og rendrer gjennom motoren. PNG legges ved resultatet.
@MainActor
final class CompositionRenderTests: XCTestCase {

    private var clock = 0.0

    private func points(_ coords: [(Double, Double)], pressure: Double) -> [StrokePoint] {
        coords.map { xy in
            clock += 6
            return StrokePoint(x: xy.0, y: xy.1, pressure: pressure,
                               tiltX: 0, tiltY: 0, timestamp: clock)
        }
    }

    private func line(_ x0: Double, _ y0: Double, _ x1: Double, _ y1: Double,
                      steps: Int = 12, pressure: Double = 0.7) -> [StrokePoint] {
        points((0...steps).map { step in
            let t = Double(step) / Double(steps)
            return (x0 + (x1 - x0) * t, y0 + (y1 - y0) * t)
        }, pressure: pressure)
    }

    private var strokeCounter = 0

    private func stroke(_ type: BrushType, size: Double, opacity: Double,
                        _ pts: [StrokePoint], tilt: Double = 0) -> PencilStroke {
        strokeCounter += 1
        var brushPoints = pts
        if tilt != 0 {
            brushPoints = brushPoints.map { point in
                var p = point
                p.tiltX = tilt
                p.tiltY = tilt * 0.4
                return p
            }
        }
        return PencilStroke(
            id: "comp-\(strokeCounter)",
            points: brushPoints,
            inputType: "pencil",
            color: "#26282e",
            width: size,
            opacity: opacity,
            brush: BrushSpec.preset(type, size: size, color: "#26282e", opacity: opacity))
    }

    func testRenderMonsterCityScene() throws {
        guard let renderer = MetalStrokeRenderer() else { throw XCTSkip("Metal utilgjengelig") }
        var strokes: [PencilStroke] = []

        // ── Ramme ──
        strokes.append(stroke(.detail, size: 2.2, opacity: 0.9,
            points([(30, 30), (1506, 30), (1506, 994), (30, 994), (30, 30)], pressure: 0.8)))

        // ── Himmel: diagonal skravering i hjørnene ──
        strokes.append(stroke(.hatch, size: 44, opacity: 0.3,
            line(80, 90, 480, 60, steps: 8, pressure: 0.5)))
        strokes.append(stroke(.speedlines, size: 44, opacity: 0.5,
            line(60, 200, 560, 90, steps: 8, pressure: 0.7)))
        strokes.append(stroke(.hatch, size: 44, opacity: 0.3,
            line(1080, 55, 1460, 100, steps: 8, pressure: 0.55)))
        strokes.append(stroke(.speedlines, size: 44, opacity: 0.5,
            line(980, 90, 1440, 210, steps: 8, pressure: 0.7)))
        // Skyer: myke layout-buer + lysløft
        strokes.append(stroke(.layout, size: 3.0, opacity: 0.5,
            points([(180, 190), (260, 160), (360, 165), (430, 185), (500, 175)], pressure: 0.5)))
        strokes.append(stroke(.lightlift, size: 110, opacity: 0.5,
            line(200, 170, 500, 150, steps: 6, pressure: 0.8)))

        // ── Bygninger ──
        // Venstre blokk
        strokes.append(stroke(.layout, size: 2.6, opacity: 0.62,
            points([(60, 780), (60, 300), (210, 300), (210, 780)], pressure: 0.75)))
        for row in 0..<6 {
            let y = 340.0 + Double(row) * 70
            strokes.append(stroke(.detail, size: 1.4, opacity: 0.7,
                line(78, y, 195, y, steps: 6, pressure: 0.5)))
        }
        strokes.append(stroke(.hatch, size: 40, opacity: 0.26,
            line(90, 720, 185, 420, steps: 6, pressure: 0.45)))
        // Midt-tårn ×2
        strokes.append(stroke(.layout, size: 2.4, opacity: 0.55,
            points([(250, 560), (250, 210), (380, 210), (380, 560)], pressure: 0.7)))
        strokes.append(stroke(.layout, size: 2.4, opacity: 0.55,
            points([(410, 610), (410, 260), (520, 260), (520, 610)], pressure: 0.7)))
        for row in 0..<4 {
            let y = 260.0 + Double(row) * 75
            strokes.append(stroke(.detail, size: 1.2, opacity: 0.62,
                line(262, y, 370, y, steps: 5, pressure: 0.45)))
        }
        // Høyre blokk (nær, mørkere)
        strokes.append(stroke(.heavy, size: 3.6, opacity: 0.7,
            points([(1400, 780), (1400, 60), (1510, 60)], pressure: 0.85)))
        strokes.append(stroke(.crosshatch, size: 46, opacity: 0.34,
            line(1425, 160, 1480, 700, steps: 9, pressure: 0.8)))

        // ── Røyk/støv rundt bygninger ──
        strokes.append(stroke(.graintex, size: 88, opacity: 0.35,
            line(360, 660, 620, 700, steps: 7, pressure: 0.75)))
        strokes.append(stroke(.smudge, size: 30, opacity: 0.8,
            line(380, 690, 560, 660, steps: 8, pressure: 0.6)))

        // ── MONSTERET ──
        // Hodekontur
        strokes.append(stroke(.heavy, size: 5.0, opacity: 0.78,
            points([(660, 120), (682, 78), (725, 55), (775, 50), (825, 66),
                    (858, 100), (868, 140)], pressure: 0.92)))
        // Øyne
        strokes.append(stroke(.detail, size: 2.0, opacity: 0.95,
            points([(718, 130), (736, 124), (748, 132)], pressure: 0.9)))
        strokes.append(stroke(.detail, size: 2.0, opacity: 0.95,
            points([(778, 130), (796, 124), (808, 133)], pressure: 0.9)))
        // Gapende kjeft + tenner
        strokes.append(stroke(.heavy, size: 4.2, opacity: 0.85,
            points([(706, 178), (700, 226), (722, 262), (764, 274), (806, 258),
                    (824, 220), (820, 178)], pressure: 0.95)))
        var teeth: [(Double, Double)] = []
        for i in 0..<7 {
            let x = 706.0 + Double(i) * 18
            teeth.append((x, 182))
            teeth.append((x + 9, 205))
        }
        strokes.append(stroke(.detail, size: 1.8, opacity: 0.95, points(teeth, pressure: 0.9)))
        // Kroppskontur venstre + arm ned i gaten (dobbelt pass — bygget linje)
        for offset in [0.0, 2.5] {
            strokes.append(stroke(.heavy, size: 5.4, opacity: 0.8,
                points([(655 + offset, 130), (585 + offset, 205), (523 + offset, 300),
                        (482 + offset, 410), (452 + offset, 520),
                        (420 + offset, 640), (398 + offset, 745)], pressure: 0.95)))
        }
        strokes.append(stroke(.heavy, size: 4.6, opacity: 0.78,
            points([(398, 745), (430, 760), (472, 748)], pressure: 0.9)))
        // Kroppskontur høyre + arm mot neven (dobbelt pass)
        for offset in [0.0, 2.5] {
            strokes.append(stroke(.heavy, size: 5.4, opacity: 0.8,
                points([(872 + offset, 140), (952 + offset, 215), (1012 + offset, 305),
                        (1058 + offset, 405), (1088 + offset, 480)], pressure: 0.95)))
        }
        // Neven: bue + fire fingre
        strokes.append(stroke(.heavy, size: 5.2, opacity: 0.85,
            points([(1075, 520), (1128, 480), (1215, 462), (1300, 478), (1355, 530),
                    (1368, 610), (1340, 678), (1268, 706)], pressure: 0.95)))
        for i in 0..<4 {
            let x0 = 1128.0 + Double(i) * 58
            strokes.append(stroke(.heavy, size: 4.2, opacity: 0.82,
                points([(x0, 486), (x0 + 16, 540), (x0 + 20, 610), (x0 + 8, 662)], pressure: 0.9)))
        }
        // Manke/pels på hode og skuldre
        strokes.append(stroke(.fur, size: 26, opacity: 0.6,
            line(668, 92, 620, 180, steps: 5, pressure: 0.8)))
        strokes.append(stroke(.fur, size: 26, opacity: 0.6,
            line(852, 92, 906, 190, steps: 5, pressure: 0.8)))
        strokes.append(stroke(.fur, size: 30, opacity: 0.55,
            line(600, 220, 760, 300, steps: 7, pressure: 0.75)))
        // Hudtekstur på torso
        strokes.append(stroke(.organictex, size: 20, opacity: 0.5,
            line(600, 320, 900, 420, steps: 8, pressure: 0.7)))
        strokes.append(stroke(.organictex, size: 20, opacity: 0.5,
            line(560, 440, 880, 560, steps: 8, pressure: 0.65)))
        strokes.append(stroke(.organictex, size: 18, opacity: 0.5,
            line(1140, 520, 1330, 600, steps: 6, pressure: 0.7)))
        // Tone-masse i kroppen: build-up over mange pass (spec §11 — skygge
        // bygges over flere strøk, som fysisk grafitt)
        for pass in 0..<6 {
            let sway = Double(pass) * 28
            strokes.append(stroke(.shade, size: 52, opacity: 0.2,
                line(560 + sway, 260 + Double(pass) * 12, 480 + sway, 660,
                     steps: 10, pressure: 0.8), tilt: 55))
        }
        for pass in 0..<4 {
            let sway = Double(pass) * 30
            strokes.append(stroke(.shade, size: 48, opacity: 0.2,
                line(760 + sway, 300, 820 + sway, 640, steps: 9, pressure: 0.7), tilt: 50))
        }
        // Mørk kjerne under hodet/bryst: solid toneblokk — strøkene MÅ
        // overlappe (avstand < halv penselbredde) for sammenhengende flate
        for pass in 0..<5 {
            strokes.append(stroke(.toneblock, size: 34, opacity: 0.55,
                line(640, 290 + Double(pass) * 13, 900, 326 + Double(pass) * 13,
                     steps: 8, pressure: 0.85)))
        }
        // Mørk venstre side av kroppen (kjerneskygge)
        for pass in 0..<7 {
            strokes.append(stroke(.toneblock, size: 30, opacity: 0.5,
                line(524 + Double(pass) * 11, 330, 464 + Double(pass) * 11, 680,
                     steps: 9, pressure: 0.8)))
        }
        // Neven: skygge under + på fingrene
        for pass in 0..<4 {
            strokes.append(stroke(.shade, size: 44, opacity: 0.22,
                line(1120, 640 + Double(pass) * 18, 1360, 668 + Double(pass) * 18,
                     steps: 7, pressure: 0.85), tilt: 60))
        }
        // Kryss-skravering i kjeftens mørke + under hodet
        strokes.append(stroke(.crosshatch, size: 30, opacity: 0.4,
            line(726, 226, 794, 246, steps: 4, pressure: 0.85)))

        // ── Gate og horisont ──
        strokes.append(stroke(.layout, size: 2.6, opacity: 0.5,
            line(30, 782, 1500, 770, steps: 10, pressure: 0.55)))
        // Våt gate: horisontale smudge-drag + lysløft-refleks
        strokes.append(stroke(.lightlift, size: 90, opacity: 0.4,
            line(560, 860, 900, 870, steps: 6, pressure: 0.7)))

        // ── Biler ──
        // Venstre bil (hel)
        strokes.append(stroke(.pencil, size: 3.4, opacity: 0.7,
            points([(100, 930), (102, 862), (150, 838), (280, 834), (330, 862),
                    (334, 930), (100, 930)], pressure: 0.8)))
        strokes.append(stroke(.detail, size: 2.0, opacity: 0.8,
            points([(150, 862), (160, 840), (270, 838), (292, 860)], pressure: 0.7)))
        for cx in [150.0, 292.0] {
            var wheel: [(Double, Double)] = []
            for i in 0...10 {
                let a = Double(i) / 10 * .pi * 2
                wheel.append((cx + cos(a) * 22, 930 + sin(a) * 22))
            }
            strokes.append(stroke(.detail, size: 2.2, opacity: 0.85, points(wheel, pressure: 0.8)))
        }
        // Midtre varebil
        strokes.append(stroke(.pencil, size: 3.0, opacity: 0.65,
            points([(430, 800), (430, 742), (462, 726), (560, 726), (582, 748),
                    (582, 800), (430, 800)], pressure: 0.75)))
        // Vrakhaug under neven: knuste biler + debris
        strokes.append(stroke(.pencil, size: 3.2, opacity: 0.7,
            points([(960, 700), (1000, 660), (1120, 648), (1230, 668), (1290, 706)], pressure: 0.8)))
        strokes.append(stroke(.debris, size: 34, opacity: 0.6,
            line(940, 740, 1330, 760, steps: 9, pressure: 0.85)))
        strokes.append(stroke(.debris, size: 30, opacity: 0.55,
            line(1000, 800, 1420, 830, steps: 9, pressure: 0.8)))
        strokes.append(stroke(.crosshatch, size: 36, opacity: 0.3,
            line(1180, 700, 1340, 740, steps: 5, pressure: 0.8)))

        // ── Soldater (strekfigurer) ──
        for (bx, by) in [(640.0, 800.0), (830.0, 820.0)] {
            var figure: [(Double, Double)] = []
            for i in 0...8 {
                let a = Double(i) / 8 * .pi * 2
                figure.append((bx + cos(a) * 13, by - 60 + sin(a) * 13))
            }
            strokes.append(stroke(.pencil, size: 2.6, opacity: 0.8, points(figure, pressure: 0.8)))
            strokes.append(stroke(.pencil, size: 2.8, opacity: 0.8,
                points([(bx, by - 47), (bx, by + 10)], pressure: 0.85)))
            strokes.append(stroke(.pencil, size: 2.4, opacity: 0.8,
                points([(bx - 22, by - 20), (bx, by - 32), (bx + 24, by - 24)], pressure: 0.8)))
            strokes.append(stroke(.pencil, size: 2.4, opacity: 0.8,
                points([(bx - 16, by + 62), (bx, by + 10), (bx + 16, by + 62)], pressure: 0.8)))
        }

        // ── Forgrunnsdebris over gaten ──
        strokes.append(stroke(.debris, size: 26, opacity: 0.45,
            line(120, 980, 620, 960, steps: 10, pressure: 0.5)))
        strokes.append(stroke(.graintex, size: 70, opacity: 0.25,
            line(200, 900, 700, 920, steps: 8, pressure: 0.5)))

        // ── Render gjennom motoren (scale 2 = skjermens dab-tetthet) ──
        renderer.resizeCanvas(width: 3072, height: 2048)
        renderer.rebuild(strokes: strokes, scale: 2)
        guard let dataURL = renderer.thumbnailDataURL(maxWidth: 1536),
              let comma = dataURL.firstIndex(of: ","),
              let data = Data(base64Encoded: String(dataURL[dataURL.index(after: comma)...])),
              let image = UIImage(data: data) else {
            XCTFail("render feilet")
            return
        }
        XCTAssertGreaterThan(strokes.count, 40)
        let attachment = XCTAttachment(image: image)
        attachment.name = "monster-city-scene"
        attachment.lifetime = .keepAlways
        add(attachment)
    }
}
