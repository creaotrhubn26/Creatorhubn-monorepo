import XCTest
import AVFoundation
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
                        _ pts: [StrokePoint], tilt: Double = 0,
                        color: String = "#26282e") -> PencilStroke {
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
            color: color,
            width: size,
            opacity: opacity,
            brush: BrushSpec.preset(type, size: size, color: color, opacity: opacity))
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

    // Rendering-klassen mot foto-referansen (troll-nærbilde): airbrush-
    // modellering, vått hår, hud/stein-tekstur, glans-highlights, soft focus.
    func testRenderTrollPortrait() throws {
        guard let renderer = MetalStrokeRenderer() else { throw XCTSkip("Metal utilgjengelig") }
        var strokes: [PencilStroke] = []
        let ink = "#1c1e22"

        // ── Bakgrunn: skog + regn, deretter soft focus over ──
        strokes.append(stroke(.forest, size: 70, opacity: 0.5,
            line(90, 460, 300, 430, steps: 5, pressure: 0.7), color: ink))
        strokes.append(stroke(.graintex, size: 90, opacity: 0.3,
            line(60, 300, 340, 520, steps: 7, pressure: 0.7), color: ink))
        strokes.append(stroke(.softfocus, size: 90, opacity: 0.8,
            line(60, 280, 340, 560, steps: 10, pressure: 0.8), color: ink))
        strokes.append(stroke(.softfocus, size: 90, opacity: 0.8,
            line(340, 560, 80, 700, steps: 8, pressure: 0.8), color: ink))
        for i in 0..<4 {
            strokes.append(stroke(.speedlines, size: 40, opacity: 0.4,
                line(120 + Double(i) * 340, 60, 60 + Double(i) * 340, 420,
                     steps: 6, pressure: 0.6), color: ink))
        }

        // ── Hodeform (stort, midtstilt) ──
        for offset in [0.0, 2.0] {
            strokes.append(stroke(.heavy, size: 5.6, opacity: 0.85,
                points([(560 + offset, 210), (610, 130), (700, 80), (820, 68),
                        (930, 92), (1010, 160), (1050, 260)], pressure: 0.95), color: ink))
        }
        // Ører
        strokes.append(stroke(.heavy, size: 4.6, opacity: 0.8,
            points([(560, 215), (505, 165), (520, 235), (560, 268)], pressure: 0.9), color: ink))
        strokes.append(stroke(.heavy, size: 4.6, opacity: 0.8,
            points([(1050, 265), (1108, 205), (1092, 285), (1050, 315)], pressure: 0.9), color: ink))
        // Kjeve + åpen munn
        for offset in [0.0, 2.0] {
            strokes.append(stroke(.heavy, size: 5.2, opacity: 0.85,
                points([(600 + offset, 480), (630, 640), (700, 740), (800, 772),
                        (900, 736), (960, 630), (985, 480)], pressure: 0.95), color: ink))
        }
        // Munnhule: solid mørk
        for pass in 0..<6 {
            strokes.append(stroke(.toneblock, size: 30, opacity: 0.7,
                line(672, 560 + Double(pass) * 13, 912, 566 + Double(pass) * 13,
                     steps: 7, pressure: 0.9), color: ink))
        }

        // ── Airbrush-modellering: øyehuler, neserygg, kinn ──
        for pass in 0..<4 {
            strokes.append(stroke(.airbrush, size: 74, opacity: 0.35,
                line(640, 240 + Double(pass) * 8, 730, 250 + Double(pass) * 8,
                     steps: 5, pressure: 0.8), color: ink))
            strokes.append(stroke(.airbrush, size: 74, opacity: 0.35,
                line(860, 240 + Double(pass) * 8, 950, 252 + Double(pass) * 8,
                     steps: 5, pressure: 0.8), color: ink))
        }
        for pass in 0..<3 {
            strokes.append(stroke(.airbrush, size: 60, opacity: 0.3,
                line(770 + Double(pass) * 14, 300, 760 + Double(pass) * 14, 460,
                     steps: 6, pressure: 0.7), color: ink))
        }
        for pass in 0..<3 {
            strokes.append(stroke(.airbrush, size: 80, opacity: 0.28,
                line(600, 420 + Double(pass) * 16, 700, 470 + Double(pass) * 16,
                     steps: 5, pressure: 0.7), color: ink))
            strokes.append(stroke(.airbrush, size: 80, opacity: 0.28,
                line(890, 430 + Double(pass) * 16, 980, 470 + Double(pass) * 16,
                     steps: 5, pressure: 0.7), color: ink))
        }

        // ── Øyne: mørk hule + iris + glint ──
        for (ex, ey) in [(672.0, 262.0), (908.0, 262.0)] {
            var socket: [(Double, Double)] = []
            for i in 0...10 {
                let a = Double(i) / 10 * .pi * 2
                socket.append((ex + cos(a) * 34, ey + sin(a) * 22))
            }
            strokes.append(stroke(.detail, size: 2.6, opacity: 0.9,
                points(socket, pressure: 0.9), color: ink))
            var iris: [(Double, Double)] = []
            for i in 0...8 {
                let a = Double(i) / 8 * .pi * 2
                iris.append((ex + cos(a) * 10, ey + sin(a) * 10))
            }
            strokes.append(stroke(.detail, size: 2.2, opacity: 0.95,
                points(iris, pressure: 0.95), color: ink))
            strokes.append(stroke(.gloss, size: 2.6, opacity: 0.9,
                points([(ex - 4, ey - 5), (ex - 1, ey - 7)], pressure: 0.9), color: "#ffffff"))
        }

        // ── Nese ──
        strokes.append(stroke(.heavy, size: 4.4, opacity: 0.8,
            points([(760, 330), (742, 420), (756, 470), (790, 486), (824, 468),
                    (836, 418), (818, 330)], pressure: 0.9), color: ink))

        // ── Tenner: konturer + glans ──
        var teethTop: [(Double, Double)] = []
        for i in 0..<8 {
            let x = 676.0 + Double(i) * 32
            teethTop.append((x, 556))
            teethTop.append((x + 16, 596))
        }
        strokes.append(stroke(.detail, size: 2.4, opacity: 0.95,
            points(teethTop, pressure: 0.9), color: ink))
        for i in 0..<8 {
            let x = 682.0 + Double(i) * 32
            strokes.append(stroke(.gloss, size: 3.2, opacity: 0.85,
                points([(x, 560), (x + 7, 578)], pressure: 0.85), color: "#ffffff"))
        }

        // ── Hud- og steintekstur ──
        strokes.append(stroke(.skintex, size: 44, opacity: 0.4,
            line(660, 180, 940, 200, steps: 7, pressure: 0.7), color: ink))
        strokes.append(stroke(.skintex, size: 40, opacity: 0.4,
            line(620, 380, 700, 430, steps: 5, pressure: 0.7), color: ink))
        strokes.append(stroke(.skintex, size: 40, opacity: 0.4,
            line(880, 380, 960, 430, steps: 5, pressure: 0.7), color: ink))
        // Skuldre: stein/gjørme
        strokes.append(stroke(.rocktex, size: 54, opacity: 0.5,
            line(1060, 560, 1420, 660, steps: 9, pressure: 0.85), color: ink))
        strokes.append(stroke(.rocktex, size: 50, opacity: 0.45,
            line(1120, 700, 1460, 800, steps: 8, pressure: 0.8), color: ink))
        strokes.append(stroke(.organictex, size: 26, opacity: 0.5,
            line(1100, 620, 1400, 730, steps: 7, pressure: 0.75), color: ink))

        // ── Vått hår: manke rundt hodet + skjegg ──
        for i in 0..<7 {
            let x = 560.0 + Double(i) * 14
            strokes.append(stroke(.wethair, size: 30, opacity: 0.65,
                line(x, 150 - Double(i) * 6, x - 40, 400, steps: 6, pressure: 0.85), color: ink))
        }
        for i in 0..<7 {
            let x = 990.0 + Double(i) * 14
            strokes.append(stroke(.wethair, size: 30, opacity: 0.65,
                line(x, 160, x + 44, 430, steps: 6, pressure: 0.85), color: ink))
        }
        for i in 0..<6 {
            let x = 660.0 + Double(i) * 50
            strokes.append(stroke(.wethair, size: 26, opacity: 0.6,
                line(x, 740, x - 8, 930, steps: 6, pressure: 0.8), color: ink))
        }

        // ── Dråper: gloss med taper ──
        for (dx0, dy0) in [(700.0, 600.0), (810.0, 640.0), (760.0, 800.0), (860.0, 820.0)] {
            strokes.append(stroke(.gloss, size: 2.8, opacity: 0.9,
                line(dx0, dy0, dx0 + 3, dy0 + 60, steps: 6, pressure: 0.8), color: "#ffffff"))
        }

        // ── Render ──
        renderer.resizeCanvas(width: 3072, height: 2048)
        renderer.rebuild(strokes: strokes, scale: 2)
        guard let dataURL = renderer.thumbnailDataURL(maxWidth: 1536),
              let comma = dataURL.firstIndex(of: ","),
              let data = Data(base64Encoded: String(dataURL[dataURL.index(after: comma)...])),
              let image = UIImage(data: data) else {
            XCTFail("render feilet")
            return
        }
        XCTAssertGreaterThan(strokes.count, 60)
        let attachment = XCTAttachment(image: image)
        attachment.name = "troll-portrait"
        attachment.lifetime = .keepAlways
        add(attachment)
    }

    // Wash-klassen mot lavering-referansen (troll over dalen): tonelag i
    // dybde (wash), tåke, pigg-pels, solstråler, skoglag.
    func testRenderValleyScene() throws {
        guard let renderer = MetalStrokeRenderer() else { throw XCTSkip("Metal utilgjengelig") }
        var strokes: [PencilStroke] = []
        let ink = "#22242a"

        // ── Himmel: wash-lag + solstråler ──
        for pass in 0..<3 {
            strokes.append(stroke(.wash, size: 70, opacity: 0.28,
                line(80, 90 + Double(pass) * 40, 1450, 70 + Double(pass) * 40,
                     steps: 10, pressure: 0.6), tilt: 45, color: ink))
        }
        for i in 0..<5 {
            strokes.append(stroke(.speedlines, size: 40, opacity: 0.35,
                line(760 + Double(i) * 30, 60, 400 + Double(i) * 120, 420,
                     steps: 6, pressure: 0.55), color: ink))
        }

        // ── Fjell i tre dybdelag: wash mørkere jo nærmere ──
        // Bakerst (lysest)
        for pass in 0..<2 {
            strokes.append(stroke(.wash, size: 80, opacity: 0.2,
                points([(60, 430), (300, 300 + Double(pass) * 14), (560, 400),
                        (820, 310), (1100, 420)], pressure: 0.6), tilt: 50, color: ink))
        }
        // Midtlag
        for pass in 0..<3 {
            strokes.append(stroke(.wash, size: 76, opacity: 0.3,
                points([(40, 560 + Double(pass) * 16), (320, 470 + Double(pass) * 16),
                        (640, 560 + Double(pass) * 16), (1000, 500 + Double(pass) * 16),
                        (1360, 580 + Double(pass) * 16)], pressure: 0.7), tilt: 50, color: ink))
        }
        // Tåke mellom lagene (hvit airbrush)
        for pass in 0..<2 {
            strokes.append(stroke(.airbrush, size: 90, opacity: 0.5,
                line(60, 470 + Double(pass) * 20, 1380, 450 + Double(pass) * 20,
                     steps: 9, pressure: 0.75), color: "#f3f0e8"))
        }

        // ── Skoglag (forest) foran fjellene ──
        strokes.append(stroke(.forest, size: 46, opacity: 0.55,
            line(80, 640, 560, 620, steps: 8, pressure: 0.7), color: ink))
        strokes.append(stroke(.forest, size: 58, opacity: 0.7,
            line(1000, 680, 1460, 700, steps: 7, pressure: 0.85), color: ink))
        strokes.append(stroke(.forest, size: 40, opacity: 0.45,
            line(600, 600, 900, 590, steps: 6, pressure: 0.6), color: ink))

        // ── Trollet over dalen ──
        for offset in [0.0, 2.0] {
            strokes.append(stroke(.heavy, size: 5.2, opacity: 0.85,
                points([(560 + offset, 480), (600, 260), (700, 140), (820, 110),
                        (940, 150), (1010, 260), (1050, 430)], pressure: 0.95), color: ink))
        }
        // Pigg-pels i rader over skuldre/hode
        for row in 0..<4 {
            let y = 180.0 + Double(row) * 70
            strokes.append(stroke(.spikes, size: 28, opacity: 0.6,
                line(620, y, 990, y - 12, steps: 8, pressure: 0.8), color: ink))
        }
        // Ansikt: airbrush-huler + kjeft
        for pass in 0..<3 {
            strokes.append(stroke(.airbrush, size: 46, opacity: 0.35,
                line(710, 220 + Double(pass) * 8, 770, 226 + Double(pass) * 8,
                     steps: 4, pressure: 0.8), color: ink))
            strokes.append(stroke(.airbrush, size: 46, opacity: 0.35,
                line(850, 220 + Double(pass) * 8, 910, 226 + Double(pass) * 8,
                     steps: 4, pressure: 0.8), color: ink))
        }
        strokes.append(stroke(.heavy, size: 4.4, opacity: 0.85,
            points([(760, 300), (770, 350), (810, 368), (852, 348), (860, 300)], pressure: 0.9), color: ink))
        for pass in 0..<3 {
            strokes.append(stroke(.toneblock, size: 22, opacity: 0.65,
                line(775, 315 + Double(pass) * 12, 848, 318 + Double(pass) * 12,
                     steps: 4, pressure: 0.9), color: ink))
        }
        // Arm + pekende hånd
        for offset in [0.0, 2.0] {
            strokes.append(stroke(.heavy, size: 4.8, opacity: 0.85,
                points([(1040 + offset, 320), (1130, 420), (1200, 520), (1230, 590)], pressure: 0.9), color: ink))
        }
        strokes.append(stroke(.heavy, size: 4.2, opacity: 0.85,
            points([(1200, 560), (1280, 620), (1330, 700), (1300, 740), (1230, 700),
                    (1190, 640)], pressure: 0.9), color: ink))
        strokes.append(stroke(.skintex, size: 36, opacity: 0.45,
            line(1150, 480, 1280, 640, steps: 6, pressure: 0.75), color: ink))

        // ── Helikopter ──
        strokes.append(stroke(.detail, size: 2.4, opacity: 0.85,
            points([(200, 190), (260, 178), (330, 186), (322, 210), (250, 216), (204, 202)], pressure: 0.85), color: ink))
        strokes.append(stroke(.detail, size: 2.0, opacity: 0.85,
            line(160, 168, 380, 164, steps: 6, pressure: 0.8), color: ink))
        strokes.append(stroke(.detail, size: 1.8, opacity: 0.8,
            line(330, 196, 400, 206, steps: 4, pressure: 0.7), color: ink))

        // ── Forgrunn: berg + to figurer bakfra ──
        strokes.append(stroke(.rocktex, size: 50, opacity: 0.55,
            line(60, 900, 480, 860, steps: 8, pressure: 0.85), color: ink))
        strokes.append(stroke(.rocktex, size: 46, opacity: 0.5,
            line(1050, 880, 1470, 920, steps: 8, pressure: 0.8), color: ink))
        // Mann m/ caps
        for offset in [0.0, 1.8] {
            strokes.append(stroke(.heavy, size: 4.2, opacity: 0.85,
                points([(200 + offset, 980), (210, 840), (260, 770), (330, 760),
                        (380, 800), (395, 900), (390, 985)], pressure: 0.9), color: ink))
        }
        strokes.append(stroke(.detail, size: 2.2, opacity: 0.85,
            points([(268, 772), (300, 748), (345, 756), (352, 776)], pressure: 0.85), color: ink))
        for pass in 0..<4 {
            strokes.append(stroke(.shade, size: 40, opacity: 0.25,
                line(230, 800 + Double(pass) * 40, 380, 820 + Double(pass) * 40,
                     steps: 5, pressure: 0.75), tilt: 50, color: ink))
        }
        // Kvinne m/ langt hår
        for offset in [0.0, 1.8] {
            strokes.append(stroke(.heavy, size: 4.2, opacity: 0.85,
                points([(430 + offset, 985), (445, 850), (490, 780), (560, 772),
                        (610, 820), (620, 930), (615, 990)], pressure: 0.9), color: ink))
        }
        for i in 0..<5 {
            strokes.append(stroke(.wethair, size: 22, opacity: 0.6,
                line(500 + Double(i) * 14, 780, 496 + Double(i) * 14, 930,
                     steps: 5, pressure: 0.8), color: ink))
        }

        // ── Ramme ──
        strokes.append(stroke(.detail, size: 2.4, opacity: 0.85,
            points([(40, 40), (1490, 40), (1490, 1000), (40, 1000), (40, 40)], pressure: 0.8), color: ink))

        // ── Render ──
        renderer.resizeCanvas(width: 3072, height: 2048)
        renderer.rebuild(strokes: strokes, scale: 2)
        guard let dataURL = renderer.thumbnailDataURL(maxWidth: 1536),
              let comma = dataURL.firstIndex(of: ","),
              let data = Data(base64Encoded: String(dataURL[dataURL.index(after: comma)...])),
              let image = UIImage(data: data) else {
            XCTFail("render feilet")
            return
        }
        XCTAssertGreaterThan(strokes.count, 50)
        let attachment = XCTAttachment(image: image)
        attachment.name = "valley-scene"
        attachment.lifetime = .keepAlways
        add(attachment)
    }

    // Tonal-analysen (§42–§43): dal-scenen skal ha spredning (ikke flat),
    // og tom canvas gir null dekning.
    func testToneReport() throws {
        guard let renderer = MetalStrokeRenderer() else { throw XCTSkip("Metal utilgjengelig") }
        renderer.resizeCanvas(width: 512, height: 512)
        let empty = renderer.toneReport()
        XCTAssertEqual(empty?.coveragePct ?? -1, 0, accuracy: 0.001)

        // Mørk flate + lys vask → to bånd
        var strokes: [PencilStroke] = []
        for pass in 0..<6 {
            strokes.append(stroke(.toneblock, size: 40, opacity: 0.9,
                line(60, 100 + Double(pass) * 18, 450, 100 + Double(pass) * 18,
                     steps: 8, pressure: 0.95)))
        }
        for pass in 0..<4 {
            strokes.append(stroke(.wash, size: 60, opacity: 0.22,
                line(60, 320 + Double(pass) * 30, 450, 320 + Double(pass) * 30,
                     steps: 8, pressure: 0.5)))
        }
        renderer.rebuild(strokes: strokes, scale: 1)
        let report = try XCTUnwrap(renderer.toneReport())
        XCTAssertGreaterThan(report.coveragePct, 0.05)
        XCTAssertGreaterThan(report.darkPct, 0.1)
        XCTAssertGreaterThan(report.lightPct, 0.1)
        XCTAssertFalse(report.isFlat)
    }

    // Flow-override skal endre dab-alpha deterministisk (editor-slideren
    // har reell effekt), og samme strøk gir samme dabs.
    func testFlowOverrideAffectsAlpha() throws {
        guard let renderer = MetalStrokeRenderer() else { throw XCTSkip("Metal utilgjengelig") }
        func maxAlpha(flow: Double) -> Float {
            var brush = BrushSpec.preset(.pencil, size: 6, color: "#000000", opacity: 0.6)
            brush.flow = flow
            let s = PencilStroke(id: "flow-1",
                points: [StrokePoint(x: 0, y: 0, pressure: 0.7, tiltX: 0, tiltY: 0, timestamp: 0),
                         StrokePoint(x: 100, y: 0, pressure: 0.7, tiltX: 0, tiltY: 0, timestamp: 80)],
                inputType: "pencil", color: "#000000", width: 6, opacity: 0.6, brush: brush)
            return renderer.dabsForStroke(s, scale: 1).map(\.alpha).max() ?? 0
        }
        let base = maxAlpha(flow: 0.8)   // preset-default for pencil
        let low = maxAlpha(flow: 0.2)
        XCTAssertGreaterThan(base, low)
        XCTAssertEqual(maxAlpha(flow: 0.8), base) // deterministisk
    }

    // §48-editor: hatch-vinkel/tetthet og miljø-tetthet lagres per strøk
    // og endrer genereringen deterministisk.
    func testEditorParamsAffectGeneration() throws {
        guard let renderer = MetalStrokeRenderer() else { throw XCTSkip("Metal utilgjengelig") }
        func hatchDabs(angle: Double?, density: Double?) -> [DabInstanceData] {
            var brush = BrushSpec.preset(.hatch, size: 34, color: "#26282e", opacity: 0.4)
            brush.hatchAngleDeg = angle
            brush.hatchDensity = density
            let s = PencilStroke(id: "ed-1",
                points: [StrokePoint(x: 50, y: 50, pressure: 0.8, tiltX: 0, tiltY: 0, timestamp: 0),
                         StrokePoint(x: 300, y: 80, pressure: 0.8, tiltX: 0, tiltY: 0, timestamp: 150)],
                inputType: "pencil", color: "#26282e", width: 34, opacity: 0.4, brush: brush)
            return renderer.dabsForStroke(s, scale: 1)
        }
        let base = hatchDabs(angle: nil, density: nil)
        let dense = hatchDabs(angle: nil, density: 2.0)
        let angled = hatchDabs(angle: 90, density: nil)
        XCTAssertGreaterThan(dense.count, base.count)          // tetthet øker merker
        XCTAssertEqual(base.count, hatchDabs(angle: nil, density: nil).count) // deterministisk
        XCTAssertNotEqual(base.first?.position, angled.first?.position)      // vinkel endrer geometri

        func envDabs(density: Double?) -> Int {
            var brush = BrushSpec.preset(.forest, size: 60, color: "#26282e", opacity: 0.6)
            brush.envDensity = density
            let s = PencilStroke(id: "ed-2",
                points: [StrokePoint(x: 80, y: 200, pressure: 0.8, tiltX: 0, tiltY: 0, timestamp: 0),
                         StrokePoint(x: 400, y: 210, pressure: 0.8, tiltX: 0, tiltY: 0, timestamp: 150)],
                inputType: "pencil", color: "#26282e", width: 60, opacity: 0.6, brush: brush)
            return renderer.dabsForStroke(s, scale: 1).count
        }
        XCTAssertGreaterThan(envDabs(density: 2.0), envDabs(density: nil))
    }

    // Skjema: editor-optionals overlever rundtur og utelates når nil.
    func testEditorParamsRoundtrip() throws {
        var brush = BrushSpec.preset(.hatch, size: 34, color: "#000000", opacity: 0.4)
        brush.hatchAngleDeg = 72
        brush.envScale = 1.4
        let s = PencilStroke(id: "rt-1",
            points: [StrokePoint(x: 1, y: 2, pressure: 0.5, tiltX: 0, tiltY: 0, timestamp: 0)],
            inputType: "pencil", color: "#000000", width: 34, opacity: 0.4, brush: brush)
        let json = try StrokeSerialization.encodeToWebJSON([s])
        let decoded = try StrokeSerialization.decodeFromWebJSON(json)
        XCTAssertEqual(decoded.first?.brush?.hatchAngleDeg, 72)
        XCTAssertEqual(decoded.first?.brush?.envScale, 1.4)

        let plain = BrushSpec.preset(.pencil, size: 3, color: "#000000", opacity: 0.5)
        let plainStroke = PencilStroke(id: "rt-2", points: s.points, inputType: "pencil",
                                       color: "#000000", width: 3, opacity: 0.5, brush: plain)
        let plainJSON = try StrokeSerialization.encodeToWebJSON([plainStroke])
        XCTAssertFalse(plainJSON.contains("hatchAngleDeg"))
        XCTAssertFalse(plainJSON.contains("envScale"))
    }

    // Density map (§70–§72): mørk sone gir høy score der og hvilesoner ellers.
    func testDensityGrid() throws {
        guard let renderer = MetalStrokeRenderer() else { throw XCTSkip("Metal utilgjengelig") }
        renderer.resizeCanvas(width: 800, height: 500)
        var strokes: [PencilStroke] = []
        for pass in 0..<6 {
            strokes.append(stroke(.toneblock, size: 36, opacity: 0.9,
                line(30, 40 + Double(pass) * 15, 180, 40 + Double(pass) * 15,
                     steps: 6, pressure: 0.95)))
        }
        renderer.rebuild(strokes: strokes, scale: 1)
        let report = try XCTUnwrap(renderer.toneReport())
        XCTAssertGreaterThan(report.densityGrid[0][0], 0.3)   // øvre venstre mørk
        XCTAssertLessThan(report.densityGrid[4][7], 0.05)     // nedre høyre tom
        XCTAssertGreaterThan(report.restZoneCount, 20)        // mest hvileflate
    }

    // Ytelsesvokter (forbedringspunkt 7): 500 blandede strøk — full
    // tegning-i-praksis (linjer + hatch + miljøgeneratorer + shade) skal
    // rebuilde godt innenfor interaktiv toleranse. Sim er tregere enn
    // device; terskelen er romslig men fanger kvadratisk regresjon.
    func testRebuildPerformance500Strokes() throws {
        guard let renderer = MetalStrokeRenderer() else { throw XCTSkip("Metal utilgjengelig") }
        renderer.resizeCanvas(width: 1920, height: 1080)
        var strokes: [PencilStroke] = []
        var rng = SystemRandomNumberGenerator()
        for i in 0..<500 {
            let x0 = Double.random(in: 40...1600, using: &rng)
            let y0 = Double.random(in: 40...1000, using: &rng)
            let pts = line(x0, y0, x0 + Double.random(in: -300...300, using: &rng),
                           y0 + Double.random(in: -200...200, using: &rng),
                           steps: 16, pressure: 0.7)
            switch i % 5 {
            case 0: strokes.append(stroke(.pencil, size: 5, opacity: 0.9, pts))
            case 1: strokes.append(stroke(.hatch, size: 40, opacity: 0.4, pts))
            case 2: strokes.append(stroke(.forest, size: 30, opacity: 0.8, pts))
            case 3: strokes.append(stroke(.shade, size: 34, opacity: 0.5, pts, tilt: 40))
            default: strokes.append(stroke(.ink, size: 4, opacity: 0.95, pts))
            }
        }
        let start = ContinuousClock.now
        renderer.rebuild(strokes: strokes, scale: 1)
        renderer.waitForPendingWork()
        let elapsed = ContinuousClock.now - start
        let seconds = Double(elapsed.components.seconds)
            + Double(elapsed.components.attoseconds) / 1e18
        print("PERF: 500 strøk rebuild + GPU-ferdig på \(String(format: "%.2f", seconds)) s")
        XCTAssertLessThan(seconds, 10, "500-strøks rebuild for treg — sjekk dab-generering/batching")
        XCTAssertNotNil(renderer.thumbnailDataURL(maxWidth: 280))
    }

    // ── Eksportveier (forbedringspunkt 9) ────────────────────────────

    private func makeFrame(strokes: [PencilStroke], id: String = "test-frame",
                           durationSec: Double = 2) -> FrameSummary {
        FrameSummary(
            id: id, shotNumber: "1A", detail: "",
            strokesJSON: try? StrokeSerialization.encodeToWebJSON(strokes),
            description: "", notes: nil, shotType: nil, lensMm: nil,
            movement: nil, durationSec: durationSec, transition: nil,
            focusDepth: nil, timeOfDay: nil, weather: nil, beatTag: nil,
            tags: [], thumbnailDataURL: nil,
            drawingWidth: 1920, drawingHeight: 1080,
            frameStatus: nil, comments: [], updatedAt: nil,
            underlayDataURL: nil, underlayOpacity: nil,
            perspectiveMode: nil, vanishingPoints: nil)
    }

    /// Tekst-annotasjoner skal med i eksport-render (CoreText-pass) —
    /// bildet med annotasjon må skille seg fra bildet uten.
    func testExportIncludesTextAnnotations() throws {
        let base = stroke(.pencil, size: 5, opacity: 0.9, line(200, 200, 900, 700))
        var annotation = stroke(.pencil, size: 4, opacity: 1,
                                points([(960, 300)], pressure: 0.7), color: "#8b5cf6")
        annotation.textAnnotation = "PUSH IN"
        let plain = FrameRenderService.image(for: makeFrame(strokes: [base]), maxWidth: 400)
        let annotated = FrameRenderService.image(
            for: makeFrame(strokes: [base, annotation]), maxWidth: 400)
        let plainPNG = try XCTUnwrap(plain?.pngData())
        let annotatedPNG = try XCTUnwrap(annotated?.pngData())
        XCTAssertNotEqual(plainPNG, annotatedPNG, "annotasjonen endret ikke eksport-bildet")
    }

    /// Animatic-MP4: total varighet = sum av shot-varigheter.
    func testAnimaticVideoDuration() async throws {
        let frameA = makeFrame(strokes: [stroke(.pencil, size: 5, opacity: 0.9,
                                                line(100, 100, 800, 600))],
                               id: "anim-1", durationSec: 1)
        let frameB = makeFrame(strokes: [stroke(.ink, size: 4, opacity: 0.95,
                                                line(300, 200, 1500, 900))],
                               id: "anim-2", durationSec: 2)
        let exported = await AnimaticVideoExporter.export(
            sceneHeading: "TESTSCENE", frames: [frameA, frameB])
        let url = try XCTUnwrap(exported)
        defer { try? FileManager.default.removeItem(at: url) }
        let duration = try await AVURLAsset(url: url).load(.duration).seconds
        XCTAssertEqual(duration, 3.0, accuracy: 0.15)
    }
}