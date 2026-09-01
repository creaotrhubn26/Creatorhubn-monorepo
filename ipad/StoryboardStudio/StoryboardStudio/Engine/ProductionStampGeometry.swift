import Foundation

/// Ren, original vektorgeometri for Stamp Engine 3.0. Ingen tredjepartsassets:
/// alle former bygges deterministisk fra film-/storyboard-primitiver.
enum ProductionStampGeometryCatalog {
    private struct Builder {
        var paths: [ProductionStampVectorPath] = []
        var rng: SeededRandom
        private var nextId = 0

        init(type: BrushType, variant: Int, seed: UInt32) {
            rng = SeededRandom(seedKey: "compound-\(type.rawValue)-\(variant)-\(seed)")
        }

        mutating func path(_ points: [(Double, Double)],
                           role: ProductionStampPathRole,
                           closed: Bool = false,
                           width: Double = 1,
                           opacity: Double = 1,
                           roughness: Double = 0) {
            guard points.count > 1 else { return }
            let vectorPoints = points.map { x, y in
                ProductionStampVectorPoint(
                    x: x + (rng.next() - 0.5) * roughness,
                    y: y + (rng.next() - 0.5) * roughness)
            }
            paths.append(ProductionStampVectorPath(
                id: "p\(nextId)", role: role, points: vectorPoints,
                closed: closed, lineWidth: width, opacity: opacity))
            nextId += 1
        }

        mutating func line(_ x0: Double, _ y0: Double,
                           _ x1: Double, _ y1: Double,
                           role: ProductionStampPathRole = .detail,
                           width: Double = 1, opacity: Double = 1,
                           roughness: Double = 0.6) {
            path([(x0, y0), (x1, y1)], role: role, width: width,
                 opacity: opacity, roughness: roughness)
        }

        mutating func ellipse(_ cx: Double, _ cy: Double,
                              _ rx: Double, _ ry: Double,
                              role: ProductionStampPathRole = .contour,
                              width: Double = 1, opacity: Double = 1,
                              start: Double = 0, end: Double = .pi * 2) {
            let steps = max(16, Int(max(rx, ry) * abs(end - start) * 0.62))
            let points = (0...steps).map { step -> (Double, Double) in
                let t = Double(step) / Double(steps)
                let angle = start + (end - start) * t
                return (cx + cos(angle) * rx, cy + sin(angle) * ry)
            }
            path(points, role: role, closed: abs(end - start) > .pi * 1.95,
                 width: width, opacity: opacity, roughness: 0.22)
        }

        mutating func cubic(_ start: (Double, Double),
                            _ control1: (Double, Double),
                            _ control2: (Double, Double),
                            _ end: (Double, Double),
                            role: ProductionStampPathRole = .contour,
                            width: Double = 1,
                            opacity: Double = 1,
                            steps: Int = 20,
                            roughness: Double = 0.2) {
            let count = max(6, steps)
            let sampled = (0...count).map { step -> (Double, Double) in
                let t = Double(step) / Double(count)
                let inverse = 1 - t
                let x = inverse * inverse * inverse * start.0
                    + 3 * inverse * inverse * t * control1.0
                    + 3 * inverse * t * t * control2.0
                    + t * t * t * end.0
                let y = inverse * inverse * inverse * start.1
                    + 3 * inverse * inverse * t * control1.1
                    + 3 * inverse * t * t * control2.1
                    + t * t * t * end.1
                return (x, y)
            }
            path(sampled, role: role, width: width,
                 opacity: opacity, roughness: roughness)
        }

        mutating func rect(_ left: Double, _ top: Double,
                           _ right: Double, _ bottom: Double,
                           role: ProductionStampPathRole = .contour,
                           width: Double = 1, opacity: Double = 1) {
            path([(left, top), (right, top), (right, bottom), (left, bottom)],
                 role: role, closed: true, width: width,
                 opacity: opacity, roughness: 0.35)
        }

        mutating func hatch(_ left: Double, _ top: Double,
                            _ right: Double, _ bottom: Double,
                            spacing: Double = 7, slope: Double = 0.6,
                            opacity: Double = 0.42) {
            var x = left
            while x <= right {
                line(x, bottom, min(right, x + (bottom - top) * slope), top,
                     role: .shadow, width: 0.72, opacity: opacity,
                     roughness: 0.35)
                x += spacing
            }
        }
    }

    static func brushType(for preset: DabPreset) -> BrushType? {
        switch preset {
        case .crowdStamp: return .crowdStamp
        case .treeStamp: return .treeStamp
        case .windowStamp: return .windowStamp
        case .carStamp: return .carStamp
        case .chairStamp: return .chairStamp
        case .faceExpressionStamp: return .faceExpressionStamp
        case .handPoseStamp: return .handPoseStamp
        case .cameraRigStamp: return .cameraRigStamp
        case .characterPoseStamp: return .characterPoseStamp
        case .doorStamp: return .doorStamp
        case .tableStamp: return .tableStamp
        case .sofaStamp: return .sofaStamp
        case .buildingStamp: return .buildingStamp
        case .streetLightStamp: return .streetLightStamp
        case .boomMicStamp: return .boomMicStamp
        case .filmLightStamp: return .filmLightStamp
        case .bedStamp: return .bedStamp
        case .staircaseStamp: return .staircaseStamp
        case .counterStamp: return .counterStamp
        case .workstationStamp: return .workstationStamp
        case .communicationStamp: return .communicationStamp
        case .luggageStamp: return .luggageStamp
        case .publicTransportStamp: return .publicTransportStamp
        case .animalStamp: return .animalStamp
        case .rockTerrainStamp: return .rockTerrainStamp
        case .waterStamp: return .waterStamp
        case .fireSmokeStamp: return .fireSmokeStamp
        case .weatherFXStamp: return .weatherFXStamp
        default: return nil
        }
    }

    static func geometry(for type: BrushType, variant: Int,
                         seed: UInt32) -> ProductionStampCompoundGeometry {
        var builder = Builder(type: type, variant: variant, seed: seed)
        let v = ProductionStampCatalog.normalizedVariant(variant, for: type)

        switch type {
        case .crowdStamp:
            addCrowd(to: &builder, variant: v)
        case .treeStamp:
            addTree(to: &builder, variant: v)
        case .windowStamp:
            addWindow(to: &builder, variant: v)
        case .carStamp:
            addCar(to: &builder, variant: v)
        case .chairStamp:
            addChair(to: &builder, variant: v)
        case .faceExpressionStamp:
            addFace(to: &builder, variant: v)
        case .handPoseStamp:
            addHand(to: &builder, variant: v)
        case .cameraRigStamp:
            addCameraRig(to: &builder, variant: v)
        case .characterPoseStamp:
            addCharacterPose(to: &builder, variant: v)
        case .doorStamp:
            addDoor(to: &builder, variant: v)
        case .tableStamp:
            addTable(to: &builder, variant: v)
        case .sofaStamp:
            addSofa(to: &builder, variant: v)
        case .buildingStamp:
            addBuilding(to: &builder, variant: v)
        case .streetLightStamp:
            addStreetLight(to: &builder, variant: v)
        case .boomMicStamp:
            addBoomMic(to: &builder, variant: v)
        case .filmLightStamp:
            addFilmLight(to: &builder, variant: v)
        case .bedStamp:
            addBed(to: &builder, variant: v)
        case .staircaseStamp:
            addStaircase(to: &builder, variant: v)
        case .counterStamp:
            addCounter(to: &builder, variant: v)
        case .workstationStamp:
            addWorkstation(to: &builder, variant: v)
        case .communicationStamp:
            addCommunication(to: &builder, variant: v)
        case .luggageStamp:
            addLuggage(to: &builder, variant: v)
        case .publicTransportStamp:
            addPublicTransport(to: &builder, variant: v)
        case .animalStamp:
            addAnimal(to: &builder, variant: v)
        case .rockTerrainStamp:
            addRockTerrain(to: &builder, variant: v)
        case .waterStamp:
            addWater(to: &builder, variant: v)
        case .fireSmokeStamp:
            addFireSmoke(to: &builder, variant: v)
        case .weatherFXStamp:
            addWeatherFX(to: &builder, variant: v)
        default:
            break
        }
        return ProductionStampCompoundGeometry(paths: builder.paths)
    }

    private static func addCrowd(to b: inout Builder, variant: Int) {
        typealias Person = (x: Double, ground: Double, scale: Double,
                            lean: Double, pose: Int)
        let people: [Person] = switch variant {
        case 1: [
            (18, 105, 0.72, 4, 1), (39, 112, 0.88, 6, 2),
            (63, 104, 0.70, 5, 1), (82, 114, 0.94, 7, 2),
            (104, 107, 0.76, 5, 1), (116, 113, 0.86, 6, 2),
        ]
        case 2: [
            (16, 91, 0.55, 0, 0), (37, 88, 0.52, 1, 0),
            (58, 92, 0.58, -1, 0), (81, 88, 0.52, 1, 0),
            (105, 92, 0.57, 0, 0), (11, 111, 0.73, -1, 0),
            (31, 115, 0.82, 1, 3), (54, 110, 0.72, 0, 0),
            (76, 116, 0.86, -1, 3), (99, 110, 0.73, 1, 0),
            (116, 115, 0.78, -1, 0),
        ]
        case 3: [
            (17, 103, 0.68, -1, 0), (38, 112, 0.90, -2, 3),
            (63, 115, 1.02, 0, 4), (87, 112, 0.90, 2, 3),
            (108, 104, 0.70, 1, 0),
        ]
        default: [
            (15, 104, 0.66, -1, 0), (37, 113, 0.88, 1, 0),
            (63, 106, 0.76, 0, 3), (88, 114, 0.91, -1, 0),
            (111, 104, 0.66, 1, 0),
        ]
        }

        func addPerson(_ person: Person, index: Int, to b: inout Builder) {
            let s = person.scale
            let x = person.x
            let ground = person.ground
            let center = x + person.lean
            let headY = ground - 70 * s
            let shoulderY = ground - 55 * s
            let hipY = ground - 29 * s
            let kneeY = ground - 13 * s
            let headWidth = 5.6 * s
            let gaze = index.isMultiple(of: 3) ? -1.2 * s : 1.1 * s

            // Eggeformet hode, nakke og asymmetrisk hårkant gir personer,
            // ikke identiske piktogrammer.
            b.ellipse(center, headY, headWidth, 7.1 * s,
                      width: 1.18, opacity: 0.96)
            b.cubic((center - headWidth, headY - 2 * s),
                    (center - 2 * s, headY - 8 * s),
                    (center + 4 * s, headY - 7 * s),
                    (center + headWidth, headY - 1 * s),
                    role: .detail, width: 0.72, opacity: 0.56,
                    steps: 9, roughness: 0.25)
            b.line(center + gaze, headY + 1.2 * s,
                   center + gaze + 2.2 * s, headY + 1.1 * s,
                   role: .detail, width: 0.55, opacity: s > 0.7 ? 0.58 : 0.3)
            b.line(center - 2.3 * s, headY + 6 * s,
                   center - 2.6 * s, shoulderY,
                   role: .contour, width: 0.78, opacity: 0.74)
            b.line(center + 2.5 * s, headY + 6 * s,
                   center + 2.8 * s, shoulderY,
                   role: .contour, width: 0.78, opacity: 0.74)

            let shoulderWidth = 11.5 * s
            let hipWidth = 6.6 * s
            b.cubic((center - shoulderWidth, shoulderY + 2 * s),
                    (center - 5 * s, shoulderY - 2 * s),
                    (center + 5 * s, shoulderY - 2 * s),
                    (center + shoulderWidth, shoulderY + 2 * s),
                    role: .contour, width: 1.08, opacity: 0.9,
                    steps: 10, roughness: 0.35)
            b.path([(center - shoulderWidth, shoulderY + 2 * s),
                    (center - hipWidth + person.lean * 0.25, hipY),
                    (center + hipWidth + person.lean * 0.25, hipY),
                    (center + shoulderWidth, shoulderY + 2 * s)],
                   role: .contour, width: 1.02, opacity: 0.86,
                   roughness: 0.42)
            b.line(center, shoulderY, center + person.lean * 0.25, hipY,
                   role: .construction, width: 0.62, opacity: 0.3)

            let hipCenter = center + person.lean * 0.25
            let stride = person.pose == 1 ? 8 * s : (person.pose == 2 ? 11 * s : 4 * s)
            b.path([(hipCenter - 3 * s, hipY),
                    (hipCenter - 4 * s - stride * 0.3, kneeY),
                    (hipCenter - 5 * s - stride, ground)],
                   role: .contour, width: 1.03, opacity: 0.88,
                   roughness: 0.45)
            b.path([(hipCenter + 3 * s, hipY),
                    (hipCenter + 4 * s + stride * 0.2, kneeY),
                    (hipCenter + 5 * s + stride * 0.72, ground)],
                   role: .contour, width: 1.03, opacity: 0.88,
                   roughness: 0.45)
            b.line(hipCenter - 7 * s - stride, ground,
                   hipCenter - 2 * s - stride, ground,
                   role: .detail, width: 0.82, opacity: 0.7)
            b.line(hipCenter + 4 * s + stride * 0.72, ground,
                   hipCenter + 9 * s + stride * 0.72, ground,
                   role: .detail, width: 0.82, opacity: 0.7)

            let raised = person.pose == 3 || person.pose == 4
            let leftHandY = raised ? shoulderY - 14 * s : hipY - 2 * s
            let rightHandY = person.pose == 4 ? shoulderY - 18 * s : hipY + 2 * s
            b.path([(center - shoulderWidth, shoulderY + 3 * s),
                    (center - 14 * s, shoulderY + (raised ? -3 : 11) * s),
                    (center - 13 * s, leftHandY)],
                   role: .contour, width: 0.92, opacity: 0.82,
                   roughness: 0.4)
            b.path([(center + shoulderWidth, shoulderY + 3 * s),
                    (center + 14 * s, shoulderY + (person.pose == 4 ? -5 : 12) * s),
                    (center + 14 * s, rightHandY)],
                   role: .contour, width: 0.92, opacity: 0.82,
                   roughness: 0.4)
            if s > 0.78 {
                b.line(center - 7 * s, shoulderY + 8 * s,
                       center + 6 * s, shoulderY + 9 * s,
                       role: .detail, width: 0.58, opacity: 0.38)
            }
        }

        // Bakre personer først og forgrunn sist gir lesbar blocking.
        for (index, person) in people.sorted(by: { $0.scale < $1.scale }).enumerated() {
            addPerson(person, index: index, to: &b)
        }
        b.cubic((7, 116), (37, 111), (87, 120), (121, 114),
                role: .shadow, width: 1.05, opacity: 0.5,
                steps: 22, roughness: 0.45)
        b.hatch(13, 107, 118, 118, spacing: 8, slope: 0.7, opacity: 0.28)
    }

    private static func addTree(to b: inout Builder, variant: Int) {
        b.line(38, 116, 94, 116, role: .shadow, width: 0.9, opacity: 0.42)
        if variant == 1 {
            b.line(64, 18, 64, 114, role: .contour, width: 1.65, opacity: 0.9)
            for level in 0..<7 {
                let y = 28 + Double(level) * 12
                let half = 11 + Double(level) * 4.6
                b.path([(64, y - 12), (64 - half, y + 11),
                        (64, y + 5), (64 + half, y + 11)],
                       role: .contour, width: 1.12, opacity: 0.88,
                       roughness: 0.75)
            }
            b.line(58, 114, 49, 118, role: .detail, width: 0.9, opacity: 0.64)
            b.line(69, 114, 80, 118, role: .detail, width: 0.9, opacity: 0.64)
            for y in stride(from: 32.0, through: 96.0, by: 16) {
                b.line(54, y, 44, y + 4, role: .detail,
                       width: 0.58, opacity: 0.42)
                b.line(74, y, 84, y + 4, role: .detail,
                       width: 0.58, opacity: 0.42)
            }
            b.hatch(47, 55, 82, 103, spacing: 8, slope: 0.35, opacity: 0.28)
            return
        }
        let wind = variant == 2 ? 14.0 : 0
        b.path([(55, 114), (59, 74), (56, 57), (63, 44),
                (70, 57), (68, 76), (75, 114)],
               role: .contour, closed: true, width: 1.45,
               opacity: 0.92, roughness: 0.55)
        b.line(63, 44, 63, 113, role: .construction,
               width: 0.7, opacity: 0.28)
        let branches: [(Double, Double, Double, Double)] = variant == 3
            ? [(62, 81, 30, 58), (66, 72, 99, 48), (61, 61, 38, 35),
               (67, 56, 87, 27), (63, 44, 53, 22), (49, 49, 27, 43),
               (83, 39, 106, 33)]
            : [(62, 77, 38 + wind, 55), (67, 70, 94 + wind, 48),
               (61, 61, 46 + wind, 41), (68, 58, 82 + wind, 36)]
        for branch in branches {
            b.line(branch.0, branch.1, branch.2, branch.3,
                   role: .detail, width: 0.98, opacity: 0.76)
        }
        b.cubic((58, 76), (56, 89), (54, 102), (53, 113),
                role: .detail, width: 0.74, opacity: 0.52,
                steps: 12, roughness: 0.32)
        b.cubic((69, 74), (67, 89), (69, 101), (72, 113),
                role: .detail, width: 0.68, opacity: 0.46,
                steps: 12, roughness: 0.3)
        b.path([(56, 111), (43, 118), (61, 114), (76, 119), (71, 111)],
               role: .detail, width: 0.94, opacity: 0.66, roughness: 0.46)
        guard variant != 3 else { return }
        b.path([(19 + wind, 66), (28 + wind, 44), (43 + wind, 37),
                (47 + wind, 23), (64 + wind, 17), (78 + wind, 26),
                (93 + wind, 31), (108 + wind, 49), (102 + wind, 68),
                (87 + wind, 78), (69 + wind, 73), (55 + wind, 83),
                (38 + wind, 74)],
               role: .contour, closed: true, width: 1.2,
               opacity: 0.88, roughness: 1.1)
        for _ in 0..<7 {
            b.ellipse(37 + wind + b.rng.next() * 57,
                      36 + b.rng.next() * 34,
                      7 + b.rng.next() * 7, 5 + b.rng.next() * 5,
                      role: .detail, width: 0.7, opacity: 0.38)
        }
        for cluster in [(37.0, 48.0, 12.0), (56.0, 32.0, 13.0),
                        (78.0, 34.0, 12.0), (93.0, 52.0, 13.0),
                        (66.0, 62.0, 15.0)] {
            b.cubic((cluster.0 - cluster.2, cluster.1),
                    (cluster.0 - cluster.2, cluster.1 - cluster.2 * 0.7),
                    (cluster.0 + cluster.2, cluster.1 - cluster.2 * 0.7),
                    (cluster.0 + cluster.2, cluster.1),
                    role: .detail, width: 0.68, opacity: 0.42,
                    steps: 10, roughness: 0.7)
        }
        b.hatch(43 + wind, 47, 88 + wind, 77,
                spacing: 9, slope: 0.45, opacity: 0.23)
    }

    private static func addWindow(to b: inout Builder, variant: Int) {
        let outer: [(Double, Double)] = variant == 1
            ? [(37, 11), (92, 15), (89, 116), (40, 112)]
            : [(22, 20), (105, 23), (101, 110), (27, 106)]
        b.path(outer, role: .contour, closed: true,
               width: 1.55, opacity: 0.96, roughness: 0.4)
        // Veggtykkelse, overligger og sålbenk gjør vinduet til et romlig
        // set piece i stedet for et flatt rektangel.
        b.path([(outer[1].0, outer[1].1), (115, outer[1].1 + 8),
                (112, outer[2].1 + 7), (outer[2].0, outer[2].1)],
               role: .detail, closed: true, width: 1.02,
               opacity: 0.7, roughness: 0.28)
        b.path([(outer[3].0 - 5, outer[3].1),
                (outer[2].0 + 8, outer[2].1 + 2),
                (outer[2].0 + 2, outer[2].1 + 9),
                (outer[3].0 - 10, outer[3].1 + 7)],
               role: .contour, closed: true, width: 1.15,
               opacity: 0.84, roughness: 0.3)
        b.path([(outer[0].0 - 3, outer[0].1 - 5),
                (outer[1].0 + 8, outer[1].1 - 2),
                (outer[1].0, outer[1].1 + 4),
                (outer[0].0, outer[0].1 + 2)],
               role: .detail, closed: true, width: 0.94,
               opacity: 0.7, roughness: 0.24)
        b.path([(outer[0].0 + 5, outer[0].1 + 6),
                (outer[1].0 - 6, outer[1].1 + 6),
                (outer[2].0 - 6, outer[2].1 - 7),
                (outer[3].0 + 6, outer[3].1 - 6)],
               role: .construction, closed: true, width: 0.75,
               opacity: 0.32, roughness: 0.2)
        if variant == 2 {
            b.path([(31, 28), (62, 29), (62, 101), (34, 98)],
                   role: .detail, closed: true, width: 0.95, opacity: 0.78)
            b.path([(66, 29), (95, 31), (112, 91), (67, 101)],
                   role: .contour, closed: true, width: 1.25, opacity: 0.93)
            b.line(97, 61, 107, 61, role: .detail, width: 0.95, opacity: 0.72)
        } else if variant == 3 {
            for column in 1...3 {
                let x = 24 + Double(column) * 20
                b.line(x, 22, x + 2, 108, role: .detail,
                       width: 0.88, opacity: 0.72)
            }
            for row in 1...2 {
                let y = 21 + Double(row) * 29
                b.line(25, y, 102, y + 2, role: .detail,
                       width: 0.88, opacity: 0.72)
            }
        } else {
            let middleX = variant == 1 ? 64.5 : 64
            b.line(middleX, 18, middleX, 109, role: .detail,
                   width: 1, opacity: 0.78)
            b.line(27, 64, 101, 65, role: .detail,
                   width: 1, opacity: 0.78)
        }
        b.line(34, 30, 57, 58, role: .detail, width: 0.65, opacity: 0.34)
        b.line(70, 71, 93, 99, role: .detail, width: 0.65, opacity: 0.34)
        for y in stride(from: 34.0, through: 96.0, by: 16) {
            b.line(105, y, 114, y + 2, role: .detail,
                   width: 0.56, opacity: 0.38)
        }
        b.cubic((30, 113), (48, 119), (91, 121), (112, 114),
                role: .shadow, width: 0.9, opacity: 0.4,
                steps: 18, roughness: 0.35)
        b.hatch(25, 96, 101, 110, spacing: 9, slope: 0.5, opacity: 0.23)
    }

    private static func addCar(to b: inout Builder, variant: Int) {
        let isThreeQuarter = variant == 1 || variant == 3
        if isThreeQuarter {
            // Front-trekvart: panser og frontflate har forskjellige plan,
            // og hjulene følger samme perspektiv i stedet for ikon-sirkler.
            let roofY = variant == 1 ? 29.0 : 34.0
            b.path([(11, 79), (17, 66), (32, 58), (45, 36),
                    (79, roofY), (101, 46), (114, 63), (118, 82),
                    (108, 94), (28, 96), (14, 88)],
                   role: .contour, closed: true, width: 1.55,
                   opacity: 0.98, roughness: 0.38)
            b.path([(36, 58), (49, 39), (76, roofY + 4), (92, 48),
                    (82, 58), (36, 58)],
                   role: .detail, closed: true, width: 0.94,
                   opacity: 0.82, roughness: 0.24)
            b.line(65, 34, 63, 58, role: .detail,
                   width: 0.76, opacity: 0.62)
            b.path([(17, 67), (35, 61), (82, 61), (108, 66),
                    (116, 80)], role: .construction,
                   width: 0.68, opacity: 0.3, roughness: 0.16)
            b.path([(15, 78), (37, 72), (87, 72), (113, 79)],
                   role: .detail, width: 0.86, opacity: 0.62,
                   roughness: 0.28)
            b.path([(16, 80), (39, 78), (43, 91), (27, 94), (14, 88)],
                   role: .detail, width: 0.92, opacity: 0.74,
                   roughness: 0.24)
            b.path([(92, 74), (111, 77), (115, 84), (105, 90)],
                   role: .detail, width: 0.9, opacity: 0.72,
                   roughness: 0.24)
            for wheel in [(36.0, 92.0, 8.0, 11.0),
                          (99.0, 88.0, 7.0, 10.0)] {
                b.ellipse(wheel.0, wheel.1, wheel.2, wheel.3,
                          width: 1.62, opacity: 0.98)
                b.ellipse(wheel.0, wheel.1, wheel.2 * 0.45, wheel.3 * 0.45,
                          role: .detail, width: 0.88, opacity: 0.72)
                for angle in stride(from: 0.0, to: Double.pi * 2,
                                    by: Double.pi / 3) {
                    b.line(wheel.0 + cos(angle) * wheel.2 * 0.45,
                           wheel.1 + sin(angle) * wheel.3 * 0.45,
                           wheel.0, wheel.1,
                           role: .detail, width: 0.54, opacity: 0.42)
                }
            }
            b.path([(21, 69), (29, 66), (35, 68), (31, 73), (21, 74)],
                   role: .detail, closed: true, width: 0.78,
                   opacity: 0.7, roughness: 0.16)
            b.path([(96, 62), (106, 64), (111, 69), (101, 68)],
                   role: .detail, closed: true, width: 0.72,
                   opacity: 0.64, roughness: 0.16)
            if variant == 3 {
                b.path([(58, 29), (64, 23), (77, 24), (83, 31)],
                       role: .detail, closed: true, width: 1.02,
                       opacity: 0.9, roughness: 0.2)
                b.line(65, 25, 65, 30, role: .shadow,
                       width: 2.3, opacity: 0.46)
                b.line(75, 25, 77, 31, role: .shadow,
                       width: 2.3, opacity: 0.46)
            }
        } else {
            let isVan = variant == 2
            let roofTop = isVan ? 27.0 : 39.0
            let roofBack = isVan ? 28.0 : 44.0
            let roofFront = isVan ? 94.0 : 78.0
            b.path([(9, 78), (18, 63), (roofBack - 8, 58),
                    (roofBack, roofTop), (roofFront, roofTop + 1),
                    (95, 58), (113, 65), (119, 81), (112, 91),
                    (16, 92), (9, 86)],
                   role: .contour, closed: true, width: 1.52,
                   opacity: 0.98, roughness: 0.38)
            b.path([(roofBack - 1, 57), (roofBack + 6, roofTop + 5),
                    (roofFront - 6, roofTop + 5), (91, 58)],
                   role: .detail, closed: true, width: 0.94,
                   opacity: 0.8, roughness: 0.22)
            let pillars = isVan ? [48.0, 72.0, 91.0] : [62.0, 81.0]
            for x in pillars {
                b.line(x, roofTop + 5, x + 1, 58,
                       role: .detail, width: 0.68, opacity: 0.56)
            }
            b.line(18, 75, 114, 76, role: .construction,
                   width: 0.66, opacity: 0.28)
            b.line(18, 82, 113, 82, role: .detail,
                   width: 0.78, opacity: 0.58)
            b.line(64, 60, 64, 88, role: .detail,
                   width: 0.7, opacity: 0.48)
            b.line(88, 60, 88, 88, role: .detail,
                   width: 0.7, opacity: 0.48)
            b.ellipse(72, 70, 1.6, 0.8, role: .detail,
                      width: 0.65, opacity: 0.62)
            for wheelX in [34.0, 96.0] {
                b.ellipse(wheelX, 91, 10, 11.5,
                          width: 1.6, opacity: 0.98)
                b.ellipse(wheelX, 91, 4.2, 4.8,
                          role: .detail, width: 0.88, opacity: 0.7)
            }
            b.path([(13, 69), (24, 65), (31, 67), (28, 72), (15, 73)],
                   role: .detail, width: 0.76, opacity: 0.66,
                   roughness: 0.18)
            b.path([(103, 66), (114, 69), (116, 74), (106, 73)],
                   role: .detail, width: 0.76, opacity: 0.66,
                   roughness: 0.18)
        }
        b.cubic((12, 105), (40, 100), (89, 108), (120, 102),
                role: .shadow, width: 1.2, opacity: 0.56,
                steps: 24, roughness: 0.42)
        b.hatch(25, 91, 110, 104, spacing: 7,
                slope: 0.5, opacity: 0.3)
    }

    private static func addChair(to b: inout Builder, variant: Int) {
        b.path([(30, 114), (99, 114), (91, 108), (37, 108)],
               role: .shadow, closed: true, width: 0.8,
               opacity: 0.38, roughness: 0.4)
        if variant == 1 {
            b.ellipse(64, 58, 31, 25, width: 1.25, opacity: 0.92,
                      start: .pi, end: .pi * 2)
            b.path([(34, 54), (94, 55), (88, 77), (40, 75)],
                   role: .contour, closed: true, width: 1.35,
                   opacity: 0.95, roughness: 0.3)
            b.line(64, 76, 64, 101, role: .contour, width: 1.4, opacity: 0.9)
            b.path([(64, 99), (42, 111), (64, 104), (86, 112)],
                   role: .detail, width: 1.1, opacity: 0.8, roughness: 0.4)
            b.path([(37, 57), (24, 62), (23, 68), (40, 66)],
                   role: .detail, width: 0.95, opacity: 0.7, roughness: 0.25)
            b.path([(91, 58), (104, 63), (105, 69), (89, 67)],
                   role: .detail, width: 0.95, opacity: 0.7, roughness: 0.25)
            for wheel in [(41.0, 112.0), (64.0, 105.0), (88.0, 113.0)] {
                b.ellipse(wheel.0, wheel.1, 3.5, 2.5,
                          role: .detail, width: 0.78, opacity: 0.68)
            }
            b.hatch(43, 59, 88, 74, spacing: 7, slope: 0.35, opacity: 0.22)
        } else if variant == 2 {
            b.path([(30, 36), (42, 24), (86, 25), (98, 38),
                    (94, 82), (82, 91), (45, 90), (33, 81)],
                   role: .contour, closed: true, width: 1.5,
                   opacity: 0.95, roughness: 0.45)
            b.path([(36, 65), (92, 65), (86, 84), (42, 84)],
                   role: .detail, closed: true, width: 0.95,
                   opacity: 0.75, roughness: 0.3)
            b.line(43, 88, 38, 112, role: .contour, width: 1.25, opacity: 0.86)
            b.line(84, 89, 90, 112, role: .contour, width: 1.25, opacity: 0.86)
            b.path([(31, 56), (18, 63), (23, 80), (43, 84)],
                   role: .contour, width: 1.18, opacity: 0.86, roughness: 0.28)
            b.path([(97, 56), (110, 63), (105, 80), (85, 84)],
                   role: .contour, width: 1.18, opacity: 0.86, roughness: 0.28)
            b.hatch(43, 68, 87, 83, spacing: 7, slope: 0.45, opacity: 0.28)
        } else if variant == 3 {
            b.path([(37, 34), (50, 61), (78, 61), (91, 34)],
                   role: .contour, closed: true, width: 1.3,
                   opacity: 0.94, roughness: 0.4)
            b.path([(35, 68), (92, 68), (81, 82), (46, 82)],
                   role: .contour, closed: true, width: 1.3,
                   opacity: 0.94, roughness: 0.35)
            b.line(41, 82, 34, 112, role: .contour, width: 1.3, opacity: 0.88)
            b.line(86, 82, 94, 112, role: .contour, width: 1.3, opacity: 0.88)
            b.line(38, 43, 91, 43, role: .detail, width: 0.8, opacity: 0.52)
            b.line(36, 60, 18, 64, role: .contour, width: 1.05, opacity: 0.82)
            b.line(91, 60, 110, 64, role: .contour, width: 1.05, opacity: 0.82)
            b.path([(43, 82), (88, 112), (82, 82), (38, 112)],
                   role: .contour, width: 1.35, opacity: 0.92, roughness: 0.3)
            b.ellipse(63, 97, 2.5, 2.5, role: .detail,
                      width: 0.8, opacity: 0.68)
            b.hatch(42, 35, 86, 57, spacing: 6, slope: 0.3, opacity: 0.24)
        } else {
            b.path([(38, 23), (83, 25), (80, 67), (41, 65)],
                   role: .contour, closed: true, width: 1.4,
                   opacity: 0.95, roughness: 0.35)
            b.line(43, 36, 79, 37, role: .detail, width: 0.72, opacity: 0.48)
            b.line(42, 50, 79, 51, role: .detail, width: 0.72, opacity: 0.48)
            b.path([(35, 69), (87, 70), (78, 84), (42, 82)],
                   role: .contour, closed: true, width: 1.4,
                   opacity: 0.95, roughness: 0.35)
            b.line(43, 82, 36, 112, role: .contour, width: 1.4, opacity: 0.88)
            b.line(77, 84, 84, 112, role: .contour, width: 1.4, opacity: 0.88)
            b.line(83, 25, 94, 107, role: .detail, width: 0.92, opacity: 0.64)
            b.line(38, 23, 33, 106, role: .detail, width: 0.92, opacity: 0.64)
            b.path([(42, 72), (82, 75), (75, 80), (45, 77)],
                   role: .detail, width: 0.7, opacity: 0.48, roughness: 0.2)
        }
        b.line(64, 26, 64, 108, role: .construction,
               width: 0.65, opacity: 0.24)
    }

    private static func addFace(to b: inout Builder, variant: Int) {
        // Trekvart hode med tydelig skalle, kinn og kjeve. Formen er med
        // vilje asymmetrisk slik at den leses som tegnet anatomi, ikke emoji.
        b.cubic((58, 13), (36, 13), (24, 31), (26, 57),
                width: 1.5, opacity: 0.97, steps: 24, roughness: 0.3)
        b.cubic((26, 57), (27, 79), (39, 99), (61, 108),
                width: 1.5, opacity: 0.97, steps: 22, roughness: 0.3)
        b.cubic((61, 108), (76, 105), (82, 95), (88, 84),
                width: 1.5, opacity: 0.97, steps: 18, roughness: 0.28)
        b.cubic((88, 84), (101, 75), (104, 56), (99, 37),
                width: 1.5, opacity: 0.97, steps: 20, roughness: 0.3)
        b.cubic((99, 37), (94, 20), (76, 12), (58, 13),
                width: 1.5, opacity: 0.97, steps: 20, roughness: 0.3)

        // Undertegning: skallevolum, øyelinje og buet senterlinje.
        b.ellipse(60, 50, 35, 38, role: .construction,
                  width: 0.62, opacity: 0.2,
                  start: .pi * 0.83, end: .pi * 2.08)
        b.cubic((63, 17), (68, 41), (72, 67), (67, 101),
                role: .construction, width: 0.65, opacity: 0.28,
                steps: 18, roughness: 0.08)
        b.cubic((29, 55), (47, 50), (76, 50), (96, 56),
                role: .construction, width: 0.62, opacity: 0.24,
                steps: 18, roughness: 0.08)

        // Hårmassen følger skallen og brytes opp av færre, selvsikre strøk.
        b.cubic((29, 43), (27, 20), (48, 8), (68, 14),
                role: .detail, width: 1.2, opacity: 0.82,
                steps: 18, roughness: 0.5)
        b.cubic((42, 31), (50, 15), (69, 15), (82, 27),
                role: .detail, width: 0.92, opacity: 0.58,
                steps: 14, roughness: 0.45)
        b.cubic((52, 27), (61, 16), (76, 20), (88, 35),
                role: .detail, width: 0.82, opacity: 0.48,
                steps: 13, roughness: 0.4)

        let nearBrow: [(Double, Double)]
        let farBrow: [(Double, Double)]
        switch variant {
        case 0: // overrasket
            nearBrow = [(40, 40), (51, 35), (62, 38)]
            farBrow = [(75, 38), (84, 35), (92, 40)]
        case 1: // glad
            nearBrow = [(39, 43), (51, 40), (62, 42)]
            farBrow = [(75, 41), (84, 39), (92, 43)]
        case 2: // bekymret
            nearBrow = [(39, 40), (51, 46), (62, 45)]
            farBrow = [(75, 45), (84, 39), (92, 39)]
        default: // sint
            nearBrow = [(39, 38), (52, 47), (63, 46)]
            farBrow = [(75, 46), (84, 42), (94, 38)]
        }
        b.path(nearBrow, role: .detail, width: 1.34,
               opacity: 0.94, roughness: 0.22)
        b.path(farBrow, role: .detail, width: 1.18,
               opacity: 0.88, roughness: 0.22)

        let eyeOpen = variant == 0 ? 5.2 : 3.2
        b.cubic((39, 52), (46, 47), (56, 48), (62, 53),
                role: .detail, width: 1.06, opacity: 0.9,
                steps: 10, roughness: 0.14)
        b.cubic((39, 52), (47, 55 + eyeOpen), (56, 56 + eyeOpen * 0.3), (62, 53),
                role: .detail, width: 0.82, opacity: 0.72,
                steps: 10, roughness: 0.12)
        b.cubic((76, 52), (82, 48), (89, 49), (94, 54),
                role: .detail, width: 0.98, opacity: 0.84,
                steps: 9, roughness: 0.14)
        b.cubic((76, 52), (82, 55 + eyeOpen * 0.7), (89, 55), (94, 54),
                role: .detail, width: 0.74, opacity: 0.66,
                steps: 9, roughness: 0.12)
        for eye in [(51.5, 53.4), (85.2, 53.4)] {
            b.ellipse(eye.0, eye.1, variant == 0 ? 2.1 : 1.5,
                      variant == 0 ? 2.8 : 2,
                      role: .detail, width: 0.82, opacity: 0.82)
        }

        // Neseplanet ligger mot nærside og får én skyggeside.
        b.cubic((70, 54), (70, 65), (65, 72), (69, 76),
                role: .detail, width: 0.9, opacity: 0.68,
                steps: 12, roughness: 0.16)
        b.cubic((69, 76), (74, 79), (81, 76), (84, 74),
                role: .detail, width: 0.86, opacity: 0.65,
                steps: 9, roughness: 0.16)
        b.line(78, 77, 82, 78, role: .shadow,
               width: 0.85, opacity: 0.48)

        switch variant {
        case 0:
            b.ellipse(69, 91, 8.5, 10.5, role: .detail,
                      width: 1.25, opacity: 0.92)
            b.ellipse(69, 93, 5, 5.5, role: .shadow,
                      width: 1, opacity: 0.42)
        case 1:
            b.cubic((49, 87), (60, 99), (75, 101), (86, 86),
                    role: .detail, width: 1.35, opacity: 0.94,
                    steps: 16, roughness: 0.2)
            b.cubic((54, 91), (63, 95), (75, 96), (82, 89),
                    role: .detail, width: 0.72, opacity: 0.56,
                    steps: 12, roughness: 0.15)
        case 2:
            b.cubic((50, 95), (60, 84), (75, 84), (84, 95),
                    role: .detail, width: 1.3, opacity: 0.92,
                    steps: 15, roughness: 0.2)
            b.line(54, 101, 80, 101, role: .shadow,
                   width: 0.76, opacity: 0.38)
        default:
            b.cubic((49, 91), (60, 86), (74, 86), (85, 91),
                    role: .detail, width: 1.34, opacity: 0.94,
                    steps: 15, roughness: 0.18)
            b.line(55, 95, 80, 95, role: .detail,
                   width: 0.7, opacity: 0.5)
        }

        b.ellipse(97, 64, 6, 10, role: .detail,
                  width: 0.92, opacity: 0.66,
                  start: -.pi * 0.52, end: .pi * 0.52)
        b.cubic((47, 104), (48, 113), (42, 118), (39, 124),
                width: 1.08, opacity: 0.74, steps: 10, roughness: 0.24)
        b.cubic((79, 101), (80, 111), (90, 116), (95, 123),
                width: 1.08, opacity: 0.74, steps: 10, roughness: 0.24)
        b.hatch(77, 61, 96, 98, spacing: 5.5,
                slope: 0.32, opacity: 0.28)
        b.hatch(30, 101, 51, 119, spacing: 6,
                slope: 0.42, opacity: 0.22)
    }

    private static func addHand(to b: inout Builder, variant: Int) {
        let outline: [(Double, Double)]
        switch variant {
        case 1:
            outline = [(40, 113), (39, 79), (47, 65), (50, 37),
                       (58, 35), (60, 68), (88, 62), (106, 65),
                       (106, 72), (77, 78), (88, 85), (84, 96), (72, 113)]
        case 2:
            outline = [(39, 110), (35, 72), (42, 50), (53, 43),
                       (83, 45), (96, 58), (94, 82), (78, 101), (72, 113)]
        case 3:
            outline = [(40, 113), (38, 82), (44, 59), (51, 43),
                       (58, 45), (55, 69), (64, 49), (71, 51),
                       (67, 72), (78, 56), (85, 60), (78, 79),
                       (91, 72), (97, 78), (82, 98), (72, 113)]
        default:
            outline = [(47, 113), (43, 83), (34, 71), (29, 57), (35, 53),
                       (46, 68), (42, 36), (49, 33), (56, 64), (55, 22),
                       (63, 20), (66, 62), (72, 29), (79, 30), (77, 66),
                       (88, 43), (95, 47), (85, 78), (80, 96), (72, 113)]
        }
        b.path(outline, role: .contour, closed: true,
               width: 1.45, opacity: 0.96, roughness: 0.45)
        b.ellipse(63, 80, 21, 25, role: .construction,
                  width: 0.68, opacity: 0.28)
        b.line(63, 55, 63, 104, role: .construction,
               width: 0.62, opacity: 0.24)
        if variant == 2 {
            for index in 0..<4 {
                let x = 48 + Double(index) * 12
                b.ellipse(x, 57 + Double(index % 2), 7, 9,
                          role: .detail, width: 0.9, opacity: 0.7,
                          start: .pi, end: .pi * 2)
            }
            b.line(43, 78, 80, 82, role: .detail,
                   width: 0.8, opacity: 0.54)
            b.path([(45, 66), (54, 72), (64, 70), (74, 75), (86, 70)],
                   role: .detail, width: 0.72, opacity: 0.5, roughness: 0.28)
        } else if variant == 3 {
            b.ellipse(69, 76, 17, 21, role: .detail,
                      width: 0.75, opacity: 0.45,
                      start: .pi * 0.1, end: .pi * 0.95)
            b.line(60, 49, 61, 94, role: .detail,
                   width: 0.64, opacity: 0.32)
            b.path([(57, 63), (65, 67), (73, 65), (82, 72)],
                   role: .detail, width: 0.68, opacity: 0.46, roughness: 0.25)
        } else {
            b.line(51, 77, 69, 93, role: .detail,
                   width: 0.72, opacity: 0.46)
            b.line(46, 88, 64, 103, role: .detail,
                   width: 0.65, opacity: 0.38)
            let nails: [(Double, Double, Double)] = variant == 1
                ? [(53, 43, 4.2), (94, 67, 4.5)]
                : [(48, 38, 3.6), (61, 26, 3.6), (76, 35, 3.3), (91, 50, 3.1)]
            for nail in nails {
                b.ellipse(nail.0, nail.1, nail.2, nail.2 * 0.55,
                          role: .detail, width: 0.58, opacity: 0.5,
                          start: .pi, end: .pi * 2)
            }
        }
        b.cubic((48, 105), (57, 100), (70, 102), (79, 108),
                role: .detail, width: 0.62, opacity: 0.42,
                steps: 10, roughness: 0.2)
        b.hatch(52, 82, 80, 104, spacing: 6, slope: 0.35, opacity: 0.24)
    }

    private static func addCameraRig(to b: inout Builder, variant: Int) {
        // Et komplett produksjonskamera: matte box, optikk, hus, monitor,
        // rails, batteri og kontroller er lesbare før riggvarianten legges på.
        b.path([(9, 43), (31, 47), (31, 75), (9, 81)],
               role: .contour, closed: true, width: 1.48,
               opacity: 0.98, roughness: 0.28)
        b.path([(13, 48), (27, 51), (27, 71), (13, 76)],
               role: .detail, closed: true, width: 0.82,
               opacity: 0.68, roughness: 0.18)
        b.path([(31, 50), (55, 48), (61, 54), (61, 69),
                (55, 75), (31, 72)],
               role: .contour, closed: true, width: 1.34,
               opacity: 0.96, roughness: 0.26)
        for x in [36.0, 43.0, 51.0, 57.0] {
            b.ellipse(x, 61.5, 3.2, 12 - abs(46 - x) * 0.12,
                      role: .detail, width: 0.72, opacity: 0.6)
        }
        b.path([(60, 38), (99, 39), (105, 47), (103, 78),
                (95, 84), (60, 78)],
               role: .contour, closed: true, width: 1.52,
               opacity: 0.98, roughness: 0.3)
        b.path([(104, 48), (118, 46), (120, 78), (103, 77)],
               role: .contour, closed: true, width: 1.18,
               opacity: 0.9, roughness: 0.24)
        b.line(110, 50, 110, 76, role: .detail,
               width: 0.68, opacity: 0.52)
        b.path([(68, 35), (70, 29), (92, 29), (96, 38)],
               role: .contour, width: 1.04,
               opacity: 0.82, roughness: 0.22)
        b.rect(68, 12, 96, 30, role: .contour,
               width: 1.2, opacity: 0.94)
        b.rect(72, 15, 92, 27, role: .detail,
               width: 0.7, opacity: 0.56)
        b.line(75, 30, 74, 37, role: .detail,
               width: 0.8, opacity: 0.66)
        b.line(90, 30, 91, 38, role: .detail,
               width: 0.8, opacity: 0.66)
        for detail in [(70.0, 48.0, 3.0), (82.0, 49.0, 2.2),
                       (92.0, 50.0, 1.7), (73.0, 68.0, 2.0)] {
            b.ellipse(detail.0, detail.1, detail.2, detail.2,
                      role: .detail, width: 0.7, opacity: 0.66)
        }
        b.rect(83, 58, 97, 75, role: .detail,
               width: 0.72, opacity: 0.56)
        b.line(29, 88, 110, 88, role: .contour,
               width: 1.05, opacity: 0.8)
        b.line(34, 94, 112, 94, role: .detail,
               width: 0.82, opacity: 0.62)
        b.line(51, 78, 51, 91, role: .detail,
               width: 0.86, opacity: 0.68)
        b.line(95, 82, 95, 92, role: .detail,
               width: 0.86, opacity: 0.68)
        b.line(31, 62, 119, 62, role: .construction,
               width: 0.62, opacity: 0.24)
        if variant == 0 {
            b.path([(56, 94), (51, 101), (76, 101), (72, 94)],
                   role: .contour, closed: true, width: 1.2,
                   opacity: 0.88, roughness: 0.22)
            b.line(61, 101, 44, 119, role: .contour, width: 1.34, opacity: 0.92)
            b.line(66, 101, 82, 119, role: .contour, width: 1.34, opacity: 0.92)
            b.line(64, 101, 63, 119, role: .detail, width: 1, opacity: 0.72)
        } else if variant == 1 {
            b.path([(57, 79), (46, 96), (32, 98), (39, 84)],
                   role: .contour, width: 1.14, opacity: 0.84, roughness: 0.32)
            b.path([(91, 83), (104, 100), (116, 95)],
                   role: .detail, width: 1.12, opacity: 0.8, roughness: 0.3)
            b.path([(104, 83), (119, 83), (122, 91), (110, 94)],
                   role: .detail, width: 0.92, opacity: 0.66, roughness: 0.24)
        } else if variant == 2 {
            b.path([(20, 96), (109, 96), (114, 105), (17, 105)],
                   role: .contour, closed: true, width: 1.16,
                   opacity: 0.84, roughness: 0.26)
            for wheelX in [24.0, 55.0, 86.0, 109.0] {
                b.ellipse(wheelX, 109, 4.5, 4.5, role: .detail,
                          width: 0.9, opacity: 0.78)
            }
            b.line(9, 119, 121, 119, role: .construction,
                   width: 0.72, opacity: 0.42)
            b.line(13, 113, 117, 113, role: .construction,
                   width: 0.72, opacity: 0.36)
        } else {
            b.line(12, 116, 119, 116, role: .shadow, width: 1.08, opacity: 0.66)
            b.line(24, 115, 39, 25, role: .contour, width: 1.28, opacity: 0.88)
            b.line(39, 25, 116, 19, role: .contour, width: 1.28, opacity: 0.88)
            b.line(103, 20, 93, 38, role: .detail, width: 1, opacity: 0.74)
            b.path([(18, 106), (29, 106), (34, 116), (14, 116)],
                   role: .detail, closed: true, width: 0.9,
                   opacity: 0.7, roughness: 0.24)
        }
        // Synsfeltet er en produksjonslinje, ikke en del av ren artwork.
        b.path([(9, 53), (1, 45), (1, 82), (9, 73)],
               role: .construction, width: 0.78,
               opacity: 0.4, roughness: 0.2)
        b.hatch(61, 64, 101, 82, spacing: 6,
                slope: 0.36, opacity: 0.22)
    }

    private static func addCharacterPose(to b: inout Builder, variant: Int) {
        typealias Pose = (head: (Double, Double), shoulder: (Double, Double),
                          hip: (Double, Double), leftElbow: (Double, Double),
                          leftHand: (Double, Double), rightElbow: (Double, Double),
                          rightHand: (Double, Double), leftKnee: (Double, Double),
                          leftFoot: (Double, Double), rightKnee: (Double, Double),
                          rightFoot: (Double, Double))
        let pose: Pose = switch variant {
        case 1: ((73, 21), (68, 39), (57, 68), (47, 48), (34, 62),
                 (83, 48), (99, 36), (43, 88), (24, 111), (71, 86), (91, 106))
        case 2: ((62, 40), (58, 55), (62, 78), (42, 64), (29, 85),
                 (75, 64), (91, 76), (43, 91), (31, 111), (77, 91), (92, 111))
        case 3: ((61, 22), (62, 41), (61, 75), (47, 55), (38, 76),
                 (83, 42), (112, 29), (50, 94), (43, 116), (73, 94), (82, 116))
        default: ((64, 20), (64, 42), (64, 76), (48, 57), (45, 82),
                  (80, 57), (83, 82), (54, 96), (50, 118), (74, 96), (78, 118))
        }
        b.ellipse(pose.head.0, pose.head.1, 8, 10, role: .contour,
                  width: 1.35, opacity: 0.96)
        b.path([(pose.shoulder.0 - 13, pose.shoulder.1),
                pose.shoulder, (pose.shoulder.0 + 13, pose.shoulder.1),
                (pose.hip.0 + 9, pose.hip.1), pose.hip,
                (pose.hip.0 - 9, pose.hip.1)], role: .contour,
               closed: true, width: 1.32, opacity: 0.94, roughness: 0.28)
        for limb in [
            (pose.shoulder, pose.leftElbow, pose.leftHand),
            (pose.shoulder, pose.rightElbow, pose.rightHand),
            (pose.hip, pose.leftKnee, pose.leftFoot),
            (pose.hip, pose.rightKnee, pose.rightFoot),
        ] {
            b.path([limb.0, limb.1, limb.2], role: .contour,
                   width: 2.15, opacity: 0.92, roughness: 0.32)
            b.ellipse(limb.1.0, limb.1.1, 2.2, 2.2, role: .detail,
                      width: 0.65, opacity: 0.5)
        }
        b.line(pose.head.0, pose.head.1 + 10,
               pose.hip.0, pose.hip.1, role: .construction,
               width: 0.66, opacity: 0.34)
        b.line(24, 120, 104, 120, role: .shadow, width: 0.78, opacity: 0.38)
    }

    private static func addDoor(to b: inout Builder, variant: Int) {
        if variant == 1 {
            b.rect(29, 13, 96, 116, role: .contour, width: 1.45, opacity: 0.96)
            b.path([(31, 16), (66, 24), (67, 108), (31, 115)],
                   role: .contour, closed: true, width: 1.4,
                   opacity: 0.96, roughness: 0.25)
            b.line(67, 24, 96, 14, role: .detail, width: 0.8, opacity: 0.58)
        } else {
            b.rect(27, 12, 101, 117, role: .contour, width: 1.5, opacity: 0.96)
            b.rect(34, 19, 94, 111, role: .contour, width: 1.08, opacity: 0.84)
            if variant == 3 {
                b.line(64, 20, 64, 110, role: .detail, width: 1, opacity: 0.74)
                b.line(35, 68, 93, 68, role: .detail, width: 0.82, opacity: 0.58)
                b.line(39, 25, 58, 54, role: .detail, width: 0.62, opacity: 0.38)
                b.line(70, 75, 89, 104, role: .detail, width: 0.62, opacity: 0.38)
            } else if variant == 2 {
                b.rect(38, 23, 90, 107, role: .shadow, width: 0.8, opacity: 0.34)
                for y in stride(from: 29.0, through: 101.0, by: 10) {
                    b.line(39, y, 89, y, role: .detail, width: 0.52, opacity: 0.32)
                }
            } else {
                for y in [28.0, 56.0, 84.0] {
                    b.rect(41, y, 59, y + 19, role: .detail, width: 0.68, opacity: 0.5)
                    b.rect(69, y, 87, y + 19, role: .detail, width: 0.68, opacity: 0.5)
                }
            }
        }
        b.ellipse(84, 68, 2.8, 2.8, role: .detail, width: 0.82, opacity: 0.78)
        b.line(19, 120, 110, 120, role: .shadow, width: 0.8, opacity: 0.4)
    }

    private static func addTable(to b: inout Builder, variant: Int) {
        if variant == 2 {
            b.ellipse(64, 47, 43, 17, role: .contour, width: 1.45, opacity: 0.96)
            b.ellipse(64, 50, 43, 17, role: .detail, width: 0.72, opacity: 0.5)
            b.line(64, 64, 64, 101, role: .contour, width: 2.1, opacity: 0.9)
            b.line(64, 101, 39, 116, role: .contour, width: 1.25, opacity: 0.82)
            b.line(64, 101, 89, 116, role: .contour, width: 1.25, opacity: 0.82)
            b.line(64, 101, 64, 119, role: .detail, width: 1, opacity: 0.7)
        } else {
            b.path([(15, 40), (90, 28), (115, 46), (40, 60)],
                   role: .contour, closed: true, width: 1.5,
                   opacity: 0.96, roughness: 0.28)
            b.path([(15, 40), (40, 60), (40, 66), (15, 47)],
                   role: .detail, closed: true, width: 0.82,
                   opacity: 0.58, roughness: 0.2)
            for leg in [(23.0, 51.0, 25.0, 112.0), (39, 62, 43, 116),
                        (105, 48, 101, 105), (88, 54, 86, 111)] {
                b.line(leg.0, leg.1, leg.2, leg.3, role: .contour,
                       width: 1.6, opacity: 0.88)
            }
            if variant == 1 {
                b.rect(20, 50, 40, 86, role: .detail, width: 0.8, opacity: 0.62)
                b.rect(85, 47, 105, 82, role: .detail, width: 0.8, opacity: 0.62)
                for y in [59.0, 70.0] {
                    b.line(22, y, 38, y, role: .detail, width: 0.55, opacity: 0.4)
                    b.line(87, y - 2, 103, y - 2, role: .detail, width: 0.55, opacity: 0.4)
                }
            } else if variant == 3 {
                b.line(23, 108, 86, 55, role: .detail, width: 0.86, opacity: 0.58)
                b.line(42, 114, 104, 50, role: .detail, width: 0.86, opacity: 0.58)
            }
        }
        b.hatch(37, 62, 103, 91, spacing: 8, slope: 0.28, opacity: 0.2)
    }

    private static func addSofa(to b: inout Builder, variant: Int) {
        let right = variant == 1 ? 116.0 : 108
        b.path([(18, 49), (28, 35), (right - 12, 35), (right, 49),
                (right - 3, 100), (26, 100), (18, 88)],
               role: .contour, closed: true, width: 1.5,
               opacity: 0.96, roughness: 0.34)
        b.path([(29, 66), (right - 12, 66), (right - 15, 88), (31, 88)],
               role: .contour, closed: true, width: 1.05,
               opacity: 0.78, roughness: 0.24)
        let cushionCount = variant == 0 || variant == 3 ? 2 : 3
        let span = (right - 44) / Double(cushionCount)
        for index in 1..<cushionCount {
            let x = 31 + Double(index) * span
            b.line(x, 38, x, 65, role: .detail, width: 0.68, opacity: 0.48)
            b.line(x, 67, x, 87, role: .detail, width: 0.68, opacity: 0.48)
        }
        if variant == 2 {
            b.path([(78, 67), (117, 76), (116, 101), (75, 91)],
                   role: .contour, closed: true, width: 1.2,
                   opacity: 0.88, roughness: 0.28)
        }
        if variant == 3 {
            for x in stride(from: 33.0, through: 93.0, by: 12) {
                b.cubic((x, 42), (x - 4, 56), (x + 5, 74), (x, 87),
                        role: .detail, width: 0.54, opacity: 0.34,
                        steps: 8, roughness: 0.3)
            }
        }
        b.line(30, 100, 27, 113, role: .contour, width: 1.15, opacity: 0.78)
        b.line(right - 10, 100, right - 7, 113, role: .contour, width: 1.15, opacity: 0.78)
        b.hatch(24, 86, right - 7, 104, spacing: 7, slope: 0.35, opacity: 0.22)
    }

    private static func addBuilding(to b: inout Builder, variant: Int) {
        let top = variant == 1 ? 11.0 : 24
        b.path([(17, top + 14), (79, top), (112, top + 17),
                (112, 111), (17, 111)], role: .contour,
               closed: true, width: 1.55, opacity: 0.96, roughness: 0.26)
        b.line(79, top, 79, 111, role: .detail, width: 0.8, opacity: 0.48)
        if variant == 0 {
            b.path([(17, 38), (51, 19), (80, 33)], role: .contour,
                   width: 1.3, opacity: 0.9, roughness: 0.22)
        }
        let rows = variant == 1 ? 4 : 2
        let columns = variant == 3 ? 3 : 2
        for row in 0..<rows {
            for column in 0..<columns {
                let x = 27 + Double(column) * (variant == 3 ? 17 : 24)
                let y = top + 25 + Double(row) * (variant == 1 ? 18 : 27)
                b.rect(x, y, x + 10, y + 12, role: .detail,
                       width: 0.62, opacity: 0.54)
            }
        }
        if variant == 2 {
            b.rect(26, 57, 73, 103, role: .detail, width: 1, opacity: 0.7)
            b.line(28, 70, 71, 70, role: .detail, width: 0.65, opacity: 0.46)
        } else if variant == 3 {
            b.rect(31, 70, 74, 110, role: .detail, width: 1, opacity: 0.68)
            for y in stride(from: 75.0, through: 105.0, by: 6) {
                b.line(32, y, 73, y, role: .detail, width: 0.52, opacity: 0.35)
            }
        } else {
            b.rect(55, 82, 70, 111, role: .detail, width: 0.85, opacity: 0.62)
        }
        b.hatch(80, top + 18, 110, 109, spacing: 7, slope: 0.3, opacity: 0.2)
    }

    private static func addStreetLight(to b: inout Builder, variant: Int) {
        if variant == 3 {
            b.rect(23, 37, 43, 87, role: .construction, width: 0.8, opacity: 0.42)
            b.path([(42, 48), (72, 48), (83, 62)], role: .contour,
                   width: 2, opacity: 0.9, roughness: 0.22)
            b.path([(70, 61), (100, 58), (110, 75), (78, 83)],
                   role: .contour, closed: true, width: 1.35,
                   opacity: 0.94, roughness: 0.24)
            b.ellipse(92, 79, 13, 14, role: .detail, width: 0.78,
                      opacity: 0.52, start: 0, end: .pi)
        } else {
            let x = 64.0
            b.rect(x - 6, 107, x + 6, 117, role: .contour,
                   width: 1.1, opacity: 0.82)
            b.line(x, 108, x, 36, role: .contour, width: 2, opacity: 0.94)
            b.line(x - 5, 91, x + 5, 91, role: .detail,
                   width: 0.72, opacity: 0.52)
            if variant == 1 {
                b.cubic((x, 37), (64, 18), (88, 14), (101, 20),
                        role: .contour, width: 1.7, opacity: 0.92,
                        steps: 16, roughness: 0.18)
                b.path([(91, 16), (113, 16), (116, 25), (95, 28)],
                       role: .contour, closed: true, width: 1.25,
                       opacity: 0.92, roughness: 0.2)
            } else if variant == 2 {
                b.line(x, 30, 34, 27, role: .contour, width: 1.45, opacity: 0.88)
                b.line(x, 30, 94, 27, role: .contour, width: 1.45, opacity: 0.88)
                b.rect(21, 22, 39, 31, role: .contour, width: 1.05, opacity: 0.82)
                b.rect(89, 22, 107, 31, role: .contour, width: 1.05, opacity: 0.82)
            } else {
                b.path([(48, 13), (80, 13), (86, 35), (42, 35)],
                       role: .contour, closed: true, width: 1.35,
                       opacity: 0.94, roughness: 0.22)
                b.ellipse(64, 25, 9, 11, role: .detail, width: 0.72, opacity: 0.5)
            }
        }
        b.line(23, 119, 108, 119, role: .shadow, width: 0.75, opacity: 0.36)
    }

    private static func addBoomMic(to b: inout Builder, variant: Int) {
        if variant == 3 {
            b.ellipse(75, 82, 23, 10, role: .contour, width: 1.35, opacity: 0.94)
            b.ellipse(75, 78, 9, 7, role: .detail, width: 0.82, opacity: 0.66)
            b.cubic((54, 86), (33, 83), (27, 101), (50, 105),
                    role: .detail, width: 0.92, opacity: 0.62,
                    steps: 18, roughness: 0.24)
        } else {
            let start = variant == 1 ? (18.0, 94.0) : (20, 44)
            let end = variant == 1 ? (105.0, 25.0) : (108, 27)
            b.line(start.0, start.1, end.0, end.1,
                   role: .contour, width: 2, opacity: 0.94)
            b.path([(end.0 - 4, end.1 - 5), (119, end.1 - 2),
                    (120, end.1 + 8), (end.0 - 2, end.1 + 7)],
                   role: .contour, closed: true, width: 1.15,
                   opacity: 0.9, roughness: 0.26)
            b.cubic((start.0 + 8, start.1 - 2), (48, 55), (78, 48),
                    (end.0 + 2, end.1 + 8), role: .detail,
                    width: 0.62, opacity: 0.5, steps: 18, roughness: 0.25)
            if variant != 1 {
                b.line(42, 57, 42, 108, role: .contour, width: 1.55, opacity: 0.88)
                b.line(42, 108, 24, 119, role: .contour, width: 1.1, opacity: 0.78)
                b.line(42, 108, 61, 119, role: .contour, width: 1.1, opacity: 0.78)
                if variant == 2 {
                    b.path([(20, 45), (10, 71), (25, 78)], role: .detail,
                           width: 1.05, opacity: 0.66, roughness: 0.3)
                }
            }
        }
    }

    private static func addFilmLight(to b: inout Builder, variant: Int) {
        if variant == 0 {
            b.ellipse(65, 34, 21, 20, role: .contour, width: 1.4, opacity: 0.96)
            for angle in stride(from: 0.0, to: Double.pi * 2, by: Double.pi / 2) {
                let x = 65 + cos(angle) * 34
                let y = 34 + sin(angle) * 31
                b.path([(65 + cos(angle) * 19, 34 + sin(angle) * 19),
                        (x - 8, y - 7), (x + 8, y + 7)],
                       role: .detail, width: 0.9, opacity: 0.64, roughness: 0.22)
            }
        } else if variant == 1 {
            b.rect(31, 16, 99, 58, role: .contour, width: 1.45, opacity: 0.96)
            for x in stride(from: 39.0, through: 91.0, by: 9) {
                for y in stride(from: 24.0, through: 50.0, by: 9) {
                    b.ellipse(x, y, 1.4, 1.4, role: .detail, width: 0.45, opacity: 0.4)
                }
            }
        } else if variant == 2 {
            b.path([(18, 18), (78, 25), (88, 68), (24, 65)],
                   role: .contour, closed: true, width: 1.45,
                   opacity: 0.96, roughness: 0.25)
            b.path([(24, 24), (70, 30), (77, 61), (28, 58)],
                   role: .detail, closed: true, width: 0.72,
                   opacity: 0.48, roughness: 0.18)
        } else {
            b.path([(24, 31), (105, 31), (111, 43), (103, 53),
                    (25, 53), (18, 43)], role: .contour,
                   closed: true, width: 1.4, opacity: 0.96, roughness: 0.24)
            b.line(31, 39, 98, 39, role: .detail, width: 0.62, opacity: 0.42)
        }
        let mountX = variant == 2 ? 69.0 : 65
        let mountY = variant == 2 ? 64.0 : 56
        b.line(mountX, mountY, mountX, 105, role: .contour, width: 1.65, opacity: 0.9)
        b.line(mountX, 104, mountX - 22, 118, role: .contour, width: 1.15, opacity: 0.8)
        b.line(mountX, 104, mountX + 22, 118, role: .contour, width: 1.15, opacity: 0.8)
        b.line(mountX, 104, mountX, 120, role: .detail, width: 0.9, opacity: 0.68)
    }

    private static func addBed(to b: inout Builder, variant: Int) {
        if variant == 2 {
            for offset in [0.0, 40.0] {
                b.path([(22, 30 + offset), (104, 30 + offset), (112, 45 + offset),
                        (30, 45 + offset)], role: .contour, closed: true,
                       width: 1.35, opacity: 0.96, roughness: 0.25)
                b.path([(34, 33 + offset), (57, 33 + offset), (61, 42 + offset),
                        (38, 42 + offset)], role: .detail, closed: true,
                       width: 0.7, opacity: 0.58, roughness: 0.18)
            }
            for x in [24.0, 108.0] {
                b.line(x, 24, x, 105, role: .contour, width: 1.5, opacity: 0.94)
            }
            b.line(108, 47, 108, 68, role: .detail, width: 0.9, opacity: 0.76)
        } else {
            let wide = variant == 1
            let left = wide ? 14.0 : 25
            let right = wide ? 116.0 : 105
            b.path([(left, 45), (right - 9, 34), (right, 90), (left + 10, 105)],
                   role: .contour, closed: true, width: 1.45,
                   opacity: 0.96, roughness: 0.28)
            b.path([(left + 8, 50), (right - 13, 40), (right - 6, 82),
                    (left + 15, 94)], role: .detail, closed: true,
                   width: 0.8, opacity: 0.62, roughness: 0.25)
            b.path([(left + 12, 51), (left + 40, 47), (left + 46, 63),
                    (left + 18, 67)], role: .detail, closed: true,
                   width: 0.72, opacity: 0.58, roughness: 0.2)
            b.line(left, 34, left, 105, role: .contour, width: 1.5, opacity: 0.92)
            b.line(right - 9, 24, right - 9, 91,
                   role: .contour, width: 1.5, opacity: 0.92)
            if variant == 3 {
                b.line(left + 5, 63, right - 7, 54,
                       role: .detail, width: 1.0, opacity: 0.8)
                b.ellipse(left + 15, 108, 4, 4, role: .detail,
                          width: 0.9, opacity: 0.72)
                b.ellipse(right - 8, 95, 4, 4, role: .detail,
                          width: 0.9, opacity: 0.72)
            }
        }
    }

    private static func addStaircase(to b: inout Builder, variant: Int) {
        if variant == 2 {
            b.ellipse(64, 66, 33, 44, role: .contour,
                      width: 1.3, opacity: 0.9, start: -.pi / 2, end: .pi * 1.45)
            b.line(64, 18, 64, 116, role: .contour, width: 1.55, opacity: 0.95)
            for index in 0..<13 {
                let angle = -Double(index) * .pi / 6.8
                let y = 24 + Double(index) * 6.8
                b.line(64, y, 64 + cos(angle) * 31, y + sin(angle) * 8,
                       role: .detail, width: 0.85, opacity: 0.72)
            }
        } else {
            let exterior = variant == 3
            let startX = exterior ? 20.0 : 22
            let endX = exterior ? 105.0 : 110
            b.path([(startX, 106), (endX, 106), (endX, 32), (92, 32)],
                   role: .contour, width: 1.45, opacity: 0.94,
                   roughness: 0.24)
            let stepCount = variant == 1 ? 10 : 12
            for index in 0..<stepCount {
                let t = Double(index) / Double(stepCount)
                let x = startX + t * 78
                let y = 105 - t * 68
                b.path([(x, y), (x + 18, y), (x + 22, y - 5)],
                       role: .detail, width: 0.82, opacity: 0.76,
                       roughness: 0.18)
            }
            b.line(startX + 2, 88, 93, 18,
                   role: .contour, width: 1.15, opacity: 0.86)
            for index in 0..<7 {
                let t = Double(index) / 6
                let x = startX + 4 + t * 70
                let y = 86 - t * 56
                b.line(x, y, x, y + 18, role: .detail,
                       width: 0.65, opacity: 0.58)
            }
            if exterior {
                b.rect(88, 26, 118, 36, role: .detail,
                       width: 0.9, opacity: 0.72)
            }
        }
    }

    private static func addCounter(to b: inout Builder, variant: Int) {
        b.path([(14, 40), (108, 31), (116, 43), (24, 53)],
               role: .contour, closed: true, width: 1.4,
               opacity: 0.96, roughness: 0.22)
        b.path([(24, 53), (116, 43), (112, 105), (25, 113)],
               role: .contour, closed: true, width: 1.35,
               opacity: 0.92, roughness: 0.25)
        for x in [48.0, 76.0, 101.0] {
            b.line(x, 51, x, 107, role: .detail,
                   width: 0.7, opacity: 0.58)
        }
        if variant == 0 {
            b.ellipse(59, 42, 18, 6, role: .detail,
                      width: 0.8, opacity: 0.68)
            b.cubic((64, 40), (64, 25), (76, 25), (76, 39),
                    role: .detail, width: 0.85, opacity: 0.74)
        } else if variant == 1 {
            b.rect(39, 70, 66, 98, role: .detail,
                   width: 0.76, opacity: 0.6)
            b.rect(72, 67, 101, 94, role: .detail,
                   width: 0.76, opacity: 0.6)
        } else {
            b.path([(22, 39), (106, 30), (106, 19), (26, 27)],
                   role: .detail, closed: true, width: 1.0,
                   opacity: 0.78, roughness: 0.2)
            if variant == 2 {
                b.rect(43, 56, 91, 91, role: .detail,
                       width: 0.7, opacity: 0.54)
            }
        }
    }

    private static func addWorkstation(to b: inout Builder, variant: Int) {
        b.path([(12, 73), (112, 67), (116, 78), (18, 85)],
               role: .contour, closed: true, width: 1.35,
               opacity: 0.94, roughness: 0.22)
        b.line(20, 84, 20, 115, role: .contour, width: 1.4, opacity: 0.88)
        b.line(108, 79, 108, 110, role: .contour, width: 1.4, opacity: 0.88)
        let screens = variant == 0 || variant == 1 ? 1 : (variant == 2 ? 2 : 3)
        for index in 0..<screens {
            let width = screens == 1 ? 45.0 : 28
            let x = 19 + Double(index) * (width + 4)
            let top = variant == 3 ? 20.0 : 26
            b.rect(x, top, x + width, 61, role: .contour,
                   width: 1.15, opacity: 0.94)
            b.line(x + 4, top + 5, x + width - 4, 56,
                   role: .detail, width: 0.55, opacity: 0.38)
            b.line(x + width / 2, 61, x + width / 2, 70,
                   role: .detail, width: 0.72, opacity: 0.66)
        }
        b.path([(39, 75), (81, 72), (91, 78), (48, 81)],
               role: .detail, closed: true, width: 0.75,
               opacity: 0.64, roughness: 0.18)
        if variant == 3 {
            for x in stride(from: 28.0, through: 100.0, by: 12) {
                b.ellipse(x, 91, 2.2, 2.2, role: .detail,
                          width: 0.55, opacity: 0.62)
            }
        }
    }

    private static func addCommunication(to b: inout Builder, variant: Int) {
        if variant == 0 {
            b.path([(42, 12), (91, 19), (86, 116), (36, 108)],
                   role: .contour, closed: true, width: 1.5,
                   opacity: 0.98, roughness: 0.2)
            b.path([(47, 25), (85, 30), (81, 98), (42, 93)],
                   role: .detail, closed: true, width: 0.72,
                   opacity: 0.5, roughness: 0.12)
            b.ellipse(62, 105, 3, 2, role: .detail,
                      width: 0.65, opacity: 0.6)
        } else if variant == 1 {
            b.path([(20, 54), (104, 48), (114, 91), (14, 98)],
                   role: .contour, closed: true, width: 1.45,
                   opacity: 0.96, roughness: 0.22)
            b.path([(22, 42), (34, 28), (90, 24), (107, 37),
                    (98, 53), (34, 58)], role: .contour,
                   closed: true, width: 1.35, opacity: 0.94,
                   roughness: 0.24)
            for row in 0..<3 {
                for column in 0..<3 {
                    b.rect(51 + Double(column) * 12, 62 + Double(row) * 10,
                           58 + Double(column) * 12, 68 + Double(row) * 10,
                           role: .detail, width: 0.5, opacity: 0.54)
                }
            }
        } else if variant == 2 {
            b.rect(39, 35, 91, 112, role: .contour,
                   width: 1.45, opacity: 0.96)
            b.line(54, 35, 50, 8, role: .contour, width: 1.2, opacity: 0.9)
            b.rect(47, 46, 83, 67, role: .detail,
                   width: 0.75, opacity: 0.62)
            for y in stride(from: 76.0, through: 99.0, by: 6) {
                b.line(48, y, 82, y, role: .detail,
                       width: 0.55, opacity: 0.54)
            }
        } else {
            b.ellipse(64, 61, 43, 48, role: .contour,
                      width: 1.45, opacity: 0.94,
                      start: .pi * 0.93, end: .pi * 2.07)
            b.ellipse(27, 76, 12, 21, role: .contour,
                      width: 1.2, opacity: 0.9)
            b.ellipse(101, 76, 12, 21, role: .contour,
                      width: 1.2, opacity: 0.9)
            b.cubic((101, 85), (109, 95), (104, 102), (91, 105),
                    role: .detail, width: 0.9, opacity: 0.74)
            b.ellipse(88, 105, 5, 3, role: .detail,
                      width: 0.65, opacity: 0.64)
        }
    }

    private static func addLuggage(to b: inout Builder, variant: Int) {
        if variant == 1 {
            b.path([(18, 55), (35, 35), (96, 37), (114, 62),
                    (105, 101), (27, 101)], role: .contour,
                   closed: true, width: 1.45, opacity: 0.96,
                   roughness: 0.3)
            b.cubic((43, 41), (48, 22), (76, 22), (85, 41),
                    role: .detail, width: 1.0, opacity: 0.72)
            b.line(31, 61, 102, 64, role: .detail,
                   width: 0.75, opacity: 0.62)
        } else if variant == 2 {
            b.path([(38, 23), (87, 27), (103, 52), (94, 111),
                    (28, 108), (22, 55)], role: .contour,
                   closed: true, width: 1.45, opacity: 0.96,
                   roughness: 0.28)
            b.rect(36, 48, 90, 78, role: .detail,
                   width: 0.8, opacity: 0.62)
            b.cubic((42, 28), (43, 13), (79, 13), (82, 29),
                    role: .detail, width: 0.95, opacity: 0.74)
            b.line(29, 59, 17, 101, role: .detail, width: 0.8, opacity: 0.62)
            b.line(96, 58, 110, 102, role: .detail, width: 0.8, opacity: 0.62)
        } else {
            let left = variant == 3 ? 15.0 : 29
            let right = variant == 3 ? 115.0 : 99
            b.rect(left, 31, right, 108, role: .contour,
                   width: 1.45, opacity: 0.96)
            b.rect(left + 7, 38, right - 7, 101, role: .detail,
                   width: 0.7, opacity: 0.54)
            b.path([(49, 31), (49, 15), (78, 15), (78, 31)],
                   role: .contour, width: 1.05, opacity: 0.82)
            b.line(left + 11, 46, right - 11, 46,
                   role: .detail, width: 0.65, opacity: 0.48)
            for x in [left + 12, right - 12] {
                b.ellipse(x, 112, 4, 4, role: .detail,
                          width: 0.8, opacity: 0.7)
            }
        }
    }

    private static func addPublicTransport(to b: inout Builder, variant: Int) {
        let tall = variant == 0
        let nose = variant == 3 ? 110.0 : 116
        b.path([(9, tall ? 38 : 45), (84, 27), (nose, 43),
                (118, 91), (101, 105), (14, 102)],
               role: .contour, closed: true, width: 1.45,
               opacity: 0.96, roughness: 0.25)
        b.path([(18, 46), (82, 35), (104, 47), (105, 68), (20, 76)],
               role: .detail, closed: true, width: 0.78,
               opacity: 0.62, roughness: 0.2)
        for x in stride(from: 30.0, through: 88.0, by: 15) {
            b.line(x, 43, x, 73, role: .detail,
                   width: 0.58, opacity: 0.52)
        }
        for x in [31.0, 91.0] {
            b.ellipse(x, 101, 10, 10, role: .contour,
                      width: 1.2, opacity: 0.92)
            b.ellipse(x, 101, 4, 4, role: .detail,
                      width: 0.65, opacity: 0.62)
        }
        if variant == 1 {
            b.line(58, 29, 65, 13, role: .detail, width: 0.85, opacity: 0.7)
            b.line(65, 13, 79, 15, role: .detail, width: 0.85, opacity: 0.7)
        }
        if variant >= 2 {
            b.line(10, 86, 114, 82, role: .detail,
                   width: 0.72, opacity: 0.62)
        }
    }

    private static func addAnimal(to b: inout Builder, variant: Int) {
        if variant == 3 {
            let birds = [(32.0, 42.0), (66, 29), (96, 52), (49, 79), (85, 91)]
            for (index, bird) in birds.enumerated() {
                b.cubic((bird.0 - 16, bird.1 + 5), (bird.0 - 9, bird.1 - 8),
                        (bird.0 - 3, bird.1 - 8), (bird.0, bird.1),
                        role: index == 0 ? .contour : .detail,
                        width: 1.0, opacity: 0.82)
                b.cubic((bird.0, bird.1), (bird.0 + 4, bird.1 - 9),
                        (bird.0 + 11, bird.1 - 9), (bird.0 + 17, bird.1 + 4),
                        role: .detail, width: 1.0, opacity: 0.82)
            }
            return
        }
        let horse = variant == 2
        let seated = variant == 1
        b.ellipse(63, horse ? 62 : 68, horse ? 38 : 31, horse ? 21 : 19,
                  role: .contour, width: 1.4, opacity: 0.96)
        b.ellipse(horse ? 103 : 96, horse ? 48 : 53,
                  horse ? 13 : 12, horse ? 18 : 14,
                  role: .contour, width: 1.25, opacity: 0.94)
        b.ellipse(horse ? 106 : 99, horse ? 49 : 53, 2, 2,
                  role: .detail, width: 0.55, opacity: 0.66)
        if seated {
            b.cubic((43, 75), (31, 92), (42, 111), (61, 112),
                    role: .contour, width: 1.2, opacity: 0.9)
            b.cubic((39, 73), (20, 84), (22, 107), (48, 111),
                    role: .detail, width: 0.8, opacity: 0.62)
        } else {
            for x in horse ? [38.0, 55.0, 80.0, 92.0] : [45.0, 57.0, 78.0, 88.0] {
                b.line(x, 78, x + (x < 65 ? -3 : 3), 112,
                       role: .contour, width: 1.1, opacity: 0.88)
                b.line(x - 4, 112, x + 5, 112,
                       role: .detail, width: 0.72, opacity: 0.64)
            }
        }
        b.cubic((31, 61), (15, 55), (13, 81), (24, 91),
                role: .detail, width: 0.9, opacity: 0.7)
    }

    private static func addRockTerrain(to b: inout Builder, variant: Int) {
        if variant == 2 {
            b.path([(15, 113), (17, 36), (34, 17), (51, 32),
                    (66, 14), (82, 34), (99, 20), (114, 45), (113, 113)],
                   role: .contour, closed: true, width: 1.4,
                   opacity: 0.94, roughness: 0.7)
            for line in [[(29.0, 41.0), (43, 109.0)],
                         [(51, 33), (61, 112)], [(81, 35), (73, 111)],
                         [(101, 46), (91, 111)]] {
                b.path(line, role: .detail, width: 0.75,
                       opacity: 0.62, roughness: 0.5)
            }
            return
        }
        let stones = variant == 3
            ? [(25.0, 88.0, 20.0), (48, 72, 25), (77, 84, 22),
               (100, 73, 17), (61, 48, 19), (88, 45, 14)]
            : variant == 1
            ? [(30.0, 91.0, 25.0), (58, 74, 31), (91, 89, 27), (78, 58, 20)]
            : [(64.0, 68.0, 47.0)]
        for (index, stone) in stones.enumerated() {
            let x = stone.0, y = stone.1, radius = stone.2
            b.path([(x - radius, y + radius * 0.5),
                    (x - radius * 0.72, y - radius * 0.6),
                    (x - radius * 0.1, y - radius),
                    (x + radius * 0.75, y - radius * 0.45),
                    (x + radius, y + radius * 0.5)],
                   role: index == 0 ? .contour : .detail,
                   closed: true, width: 1.0, opacity: 0.86,
                   roughness: 0.7)
            b.line(x - radius * 0.45, y - radius * 0.25,
                   x + radius * 0.38, y + radius * 0.18,
                   role: .detail, width: 0.62, opacity: 0.5,
                   roughness: 0.6)
        }
    }

    private static func addWater(to b: inout Builder, variant: Int) {
        if variant == 3 {
            b.cubic((8, 91), (37, 79), (49, 31), (78, 26),
                    role: .contour, width: 1.45, opacity: 0.92,
                    steps: 28, roughness: 0.25)
            b.cubic((78, 26), (108, 29), (119, 53), (105, 73),
                    role: .contour, width: 1.35, opacity: 0.9,
                    steps: 24, roughness: 0.25)
            for offset in [0.0, 9.0, 18.0, 27.0] {
                b.cubic((12, 95 + offset * 0.3), (44, 81 + offset),
                        (79, 61 + offset), (116, 78 + offset * 0.6),
                        role: .detail, width: 0.72, opacity: 0.56,
                        steps: 22, roughness: 0.2)
            }
        } else if variant == 0 {
            b.ellipse(64, 70, 51, 27, role: .contour,
                      width: 1.2, opacity: 0.82)
            for radius in [10.0, 21.0, 34.0] {
                b.ellipse(61, 66, radius, radius * 0.34,
                          role: .detail, width: 0.65, opacity: 0.52)
            }
            b.line(61, 24, 61, 55, role: .detail,
                   width: 0.58, opacity: 0.46)
        } else {
            b.cubic((8, 36), (39, 19), (68, 49), (120, 26),
                    role: .contour, width: 1.2, opacity: 0.8,
                    steps: 28, roughness: 0.35)
            b.cubic((7, 100), (38, 82), (75, 108), (121, 83),
                    role: .contour, width: 1.2, opacity: 0.8,
                    steps: 28, roughness: 0.35)
            for y in [51.0, 63.0, 75.0, 88.0] {
                b.cubic((16, y), (45, y - 7), (78, y + 6), (112, y - 3),
                        role: .detail, width: 0.62, opacity: 0.48,
                        steps: 18, roughness: 0.22)
            }
            if variant == 2 {
                for x in stride(from: 19.0, through: 108.0, by: 15) {
                    b.line(x, 36, x - 3, 17, role: .detail,
                           width: 0.65, opacity: 0.52)
                }
            }
        }
    }

    private static func addFireSmoke(to b: inout Builder, variant: Int) {
        if variant < 2 {
            let baseY = 108.0
            let flames = variant == 0
                ? [(64.0, 27.0, 23.0)]
                : [(42.0, 39.0, 20.0), (65, 21, 27), (89, 43, 18)]
            for (index, flame) in flames.enumerated() {
                b.cubic((flame.0 - flame.2, baseY),
                        (flame.0 - flame.2 * 0.8, 70),
                        (flame.0 - 8, flame.1 + 19), (flame.0, flame.1),
                        role: index == 0 ? .contour : .detail,
                        width: 1.2, opacity: 0.88, steps: 20, roughness: 0.35)
                b.cubic((flame.0, flame.1),
                        (flame.0 + 13, flame.1 + 27),
                        (flame.0 + flame.2, 72),
                        (flame.0 + flame.2, baseY),
                        role: .contour, width: 1.2, opacity: 0.88,
                        steps: 20, roughness: 0.35)
            }
            b.line(28, 109, 99, 109, role: .detail,
                   width: 1.0, opacity: 0.65, roughness: 1)
        } else {
            let centers = variant == 2
                ? [(62.0, 103.0, 16.0), (58, 81, 22), (68, 56, 25), (60, 28, 18)]
                : [(29.0, 94.0, 19.0), (49, 79, 26), (75, 82, 29),
                   (95, 63, 22), (66, 49, 26)]
            for (index, cloud) in centers.enumerated() {
                b.ellipse(cloud.0, cloud.1, cloud.2, cloud.2 * 0.72,
                          role: index == 0 ? .contour : .detail,
                          width: 0.95, opacity: 0.48 + Double(index % 2) * 0.14)
            }
            b.cubic((34, 112), (50, 105), (76, 108), (96, 112),
                    role: .detail, width: 0.72, opacity: 0.48,
                    steps: 14, roughness: 0.45)
            if variant == 3 {
                for angle in stride(from: -2.7, through: -0.25, by: 0.38) {
                    b.line(64, 92, 64 + cos(angle) * 55, 92 + sin(angle) * 55,
                           role: .detail, width: 0.75, opacity: 0.58)
                }
            }
        }
    }

    private static func addWeatherFX(to b: inout Builder, variant: Int) {
        if variant == 0 {
            for index in 0..<19 {
                let x = 9 + Double(index % 7) * 18 + Double(index / 7) * 4
                let y = 13 + Double(index / 7) * 35 + Double(index % 3) * 6
                b.line(x, y, x - 13, y + 31,
                       role: index == 0 ? .contour : .detail,
                       width: 0.72, opacity: 0.58, roughness: 0.45)
            }
            b.ellipse(55, 111, 12, 3, role: .detail,
                      width: 0.62, opacity: 0.48)
        } else if variant == 1 {
            for index in 0..<24 {
                let x = 12 + Double((index * 37) % 103)
                let y = 13 + Double((index * 29) % 101)
                b.ellipse(x, y, 1.8 + Double(index % 3), 1.8 + Double(index % 3),
                          role: index == 0 ? .contour : .detail,
                          width: 0.55, opacity: 0.48)
                if index % 5 == 0 {
                    b.line(x - 4, y, x + 4, y, role: .detail,
                           width: 0.45, opacity: 0.42)
                }
            }
        } else if variant == 2 {
            for offset in [0.0, 19.0, 39.0, 60.0] {
                b.cubic((8, 28 + offset), (38, 11 + offset),
                        (75, 47 + offset), (119, 25 + offset),
                        role: offset == 0 ? .contour : .detail,
                        width: 0.9, opacity: 0.58,
                        steps: 22, roughness: 0.25)
            }
            for x in [36.0, 70.0, 101.0] {
                b.path([(x, 48), (x + 7, 43), (x + 12, 49),
                        (x + 5, 55)], role: .detail, closed: true,
                       width: 0.58, opacity: 0.5, roughness: 0.3)
            }
        } else {
            for index in 0..<7 {
                let y = 43 + Double(index) * 9
                b.cubic((5, y), (28, y - 15), (54, y + 13), (75, y),
                        role: index == 0 ? .contour : .detail,
                        width: 1.0, opacity: 0.28 + Double(index) * 0.035,
                        steps: 20, roughness: 0.38)
                b.cubic((58, y + 2), (79, y - 13), (105, y + 12), (123, y - 1),
                        role: .detail, width: 1.0,
                        opacity: 0.28 + Double(index) * 0.035,
                        steps: 20, roughness: 0.38)
            }
        }
    }

    static func roleOpacity(_ role: ProductionStampPathRole,
                            depth: ProductionStampDepth) -> Double {
        switch (depth, role) {
        case (.background, .construction): return 0
        case (.background, .detail): return 0.42
        case (.background, .shadow): return 0.34
        case (.background, .contour): return 0.9
        case (.midground, .construction): return 0.16
        case (.midground, .detail): return 0.72
        case (.midground, .shadow): return 0.52
        case (.midground, .contour): return 0.96
        case (.foreground, .construction): return 0.24
        case (.foreground, .detail): return 0.9
        case (.foreground, .shadow): return 0.68
        case (.foreground, .contour): return 1
        }
    }

    static func skewed(_ point: ProductionStampVectorPoint,
                       designSize: Double, skew: Double) -> ProductionStampVectorPoint {
        let y = point.y / max(1, designSize) - 0.5
        return ProductionStampVectorPoint(
            x: point.x + y * designSize * min(0.45, max(-0.45, skew)),
            y: point.y)
    }

    /// Gjør ett compound-objekt om til ordinære, individuelt redigerbare
    /// penselstrøk. Første komponent bærer én semantisk stamp-kontekst.
    static func releasedStrokes(from source: PencilStroke,
                                using override: ProductionStampInstance? = nil)
        -> [PencilStroke] {
        guard let brush = source.brush,
              brush.type.isProductionStamp,
              let center = source.points.first,
              let stamp = override ?? source.stampInstance,
              let kind = brush.productionMark
                ?? ProductionMarkCatalog.profile(for: brush.type)?.kind else { return [] }
        let geometry = stamp.compoundGeometry
            ?? geometry(for: brush.type, variant: stamp.variant, seed: stamp.seed)
        let designSize = max(1, geometry.designSize)
        let baseSize = brush.size * stamp.scale * stamp.depth.renderScale
        let radians = stamp.rotationDegrees * .pi / 180
        let cosA = cos(radians), sinA = sin(radians)
        let style = stamp.styleProfileId.lowercased()
        let releasedBrushType: BrushType = {
            if style.contains("charcoal") { return .vineCharcoal }
            if style.contains("clean") || style.contains("ink") { return .nibFine }
            if style.contains("color") { return .colorHard }
            return .sketchHB
        }()
        let context = ReleasedProductionStampContext(
            originalStrokeId: source.id, kind: kind,
            centerX: center.x, centerY: center.y,
            baseSize: baseSize, stamp: stamp)
        var emittedContext = false
        var timestamp = center.timestamp

        return geometry.paths.compactMap { path in
            let roleMultiplier = roleOpacity(path.role, depth: stamp.depth)
            guard roleMultiplier > 0, path.points.count > 1 else { return nil }
            var points = path.points.map { point -> StrokePoint in
                let skewed = skewed(point, designSize: designSize,
                                    skew: stamp.perspectiveSkew ?? 0)
                var localX = (skewed.x / designSize - 0.5) * baseSize
                let localY = (skewed.y / designSize - 0.5) * baseSize
                if stamp.flipX { localX *= -1 }
                let x = center.x + localX * cosA - localY * sinA
                let y = center.y + localX * sinA + localY * cosA
                timestamp += 1
                let pressure: Double = switch path.role {
                case .construction: 0.25
                case .contour: 0.82
                case .detail: 0.58
                case .shadow: 0.46
                }
                return StrokePoint(x: x, y: y, pressure: pressure,
                                   tiltX: 0, tiltY: 0, timestamp: timestamp)
            }
            if path.closed, let first = points.first { points.append(first) }
            let lineWidth = max(0.7, path.lineWidth * baseSize / designSize)
            let opacity = min(1, max(0.04,
                source.opacity * path.opacity * roleMultiplier))
            var releasedBrush = BrushSpec.preset(
                releasedBrushType, size: lineWidth,
                color: source.color, opacity: opacity)
            if path.role == .construction { releasedBrush.grain *= 0.8 }
            let releasedContext = emittedContext ? nil : context
            emittedContext = true
            return PencilStroke(
                id: "\(source.id)-component-\(path.id)", points: points,
                inputType: source.inputType, color: source.color,
                width: lineWidth, opacity: opacity, brush: releasedBrush,
                boardLayer: source.boardLayer,
                stampGroupId: source.id, stampComponentRole: path.role,
                releasedStampContext: releasedContext)
        }
    }
}
