import Foundation

/// Standardscenen — talkshow-oppsettet fra HTML-prototypen (`virtual-studio-ipad.html`).
enum DefaultScene {
    static func make() -> SceneData {
        SceneData(
            nodes: [
                // Props
                Node(id: "floor", name: "Floor", kind: .prop, enabled: true,
                     transform: Transform(position: [0, 0, 0], rotationEulerDeg: .zero, scale: [12, 1, 12]),
                     params: .prop(PropParams(material: "Matte Charcoal", shape: .plane))),
                Node(id: "led-wall", name: "LED Wall", kind: .prop, enabled: true,
                     transform: Transform(position: [0, 1.8, -2.4], rotationEulerDeg: .zero, scale: [6, 3.6, 0.12]),
                     params: .prop(PropParams(material: "LED · 1.9mm pitch", shape: .box))),
                Node(id: "stage", name: "Stage", kind: .prop, enabled: true,
                     transform: Transform(position: [0, 0, 0], rotationEulerDeg: .zero, scale: [3.2, 1, 3.2]),
                     params: .prop(PropParams(material: "Riser · Carpet", shape: .stage))),
                Node(id: "background", name: "Background", kind: .prop, enabled: true,
                     transform: Transform(position: [0, 3, -4], rotationEulerDeg: .zero, scale: [14, 6, 0.1]),
                     params: .prop(PropParams(material: "Void Black", shape: .box))),
                Node(id: "chair-left", name: "Chair Left", kind: .prop, enabled: true,
                     transform: Transform(position: [-0.7, 0.58, 0.2], rotationEulerDeg: [0, 8, 0], scale: [0.6, 0.85, 0.6]),
                     params: .prop(PropParams(material: "Slate Bouclé", shape: .box))),
                Node(id: "chair-right", name: "Chair Right", kind: .prop, enabled: true,
                     transform: Transform(position: [0.7, 0.58, 0.2], rotationEulerDeg: [0, -8, 0], scale: [0.6, 0.85, 0.6]),
                     params: .prop(PropParams(material: "Slate Bouclé", shape: .box))),
                Node(id: "coffee-table", name: "Coffee Table", kind: .prop, enabled: true,
                     transform: Transform(position: [0, 0.35, 0.3], rotationEulerDeg: .zero, scale: [1.1, 0.4, 0.7]),
                     params: .prop(PropParams(material: "Walnut", shape: .box))),
                // Lys
                Node(id: "key-light", name: "Key Light", kind: .light, enabled: true,
                     transform: Transform(position: [2.45, 3.10, 2.80], rotationEulerDeg: [-33, 41, 0], scale: .one),
                     params: .light(LightParams(type: .spot, intensity: 85, temperatureK: 5600, beamDeg: 45, castsShadows: true, quality: "High"))),
                Node(id: "fill-light", name: "Fill Light", kind: .light, enabled: true,
                     transform: Transform(position: [-2.45, 3.10, 2.80], rotationEulerDeg: [-33, -41, 0], scale: .one),
                     params: .light(LightParams(type: .area, intensity: 45, temperatureK: 6200, beamDeg: 70, castsShadows: false, quality: "Medium"))),
                Node(id: "back-light", name: "Back Light", kind: .light, enabled: true,
                     transform: Transform(position: [0, 4.2, -1.6], rotationEulerDeg: [-60, 180, 0], scale: .one),
                     params: .light(LightParams(type: .spot, intensity: 60, temperatureK: 5000, beamDeg: 30, castsShadows: false, quality: "Medium"))),
                // Kameraer
                Node(id: "camera-a", name: "Camera A", kind: .camera, enabled: true,
                     transform: Transform(position: [0.2, 1.4, 4.6], rotationEulerDeg: [-2, 2, 0], scale: .one),
                     params: .camera(CameraParams(focalMm: 35, aperture: "f/2.8", iso: 800, shutter: "1/50", dofEnabled: true, role: "Wide master"))),
                Node(id: "camera-b", name: "Camera B", kind: .camera, enabled: true,
                     transform: Transform(position: [-2.8, 1.5, 4.1], rotationEulerDeg: [-5, -33, 0], scale: .one),
                     params: .camera(CameraParams(focalMm: 50, aperture: "f/2.0", iso: 640, shutter: "1/50", dofEnabled: true, role: "Cross on host"))),
                Node(id: "camera-c", name: "Camera C", kind: .camera, enabled: true,
                     transform: Transform(position: [2.9, 1.5, 4.0], rotationEulerDeg: [-5, 35, 0], scale: .one),
                     params: .camera(CameraParams(focalMm: 85, aperture: "f/1.8", iso: 800, shutter: "1/50", dofEnabled: true, role: "Cross on guest"))),
                // Talent
                Node(id: "host", name: "Host", kind: .talent, enabled: true,
                     transform: Transform(position: [-0.7, 0.85, 0.2], rotationEulerDeg: [0, 12, 0], scale: [0.45, 0.85, 0.45]),
                     params: .talent(TalentParams(seat: "Chair Left", eyeline: true, marker: "A"))),
                Node(id: "guest", name: "Guest", kind: .talent, enabled: true,
                     transform: Transform(position: [0.7, 0.85, 0.2], rotationEulerDeg: [0, -12, 0], scale: [0.45, 0.85, 0.45]),
                     params: .talent(TalentParams(seat: "Chair Right", eyeline: true, marker: "B"))),
            ],
            groups: [
                Group(id: "studio", name: "Studio", childIds: ["floor", "led-wall", "stage", "chair-left", "chair-right", "coffee-table"]),
                Group(id: "lights", name: "Lights", childIds: ["key-light", "fill-light", "back-light"]),
                Group(id: "cameras", name: "Cameras", childIds: ["camera-a", "camera-b", "camera-c"]),
                Group(id: "talent", name: "Talent", childIds: ["host", "guest"]),
                Group(id: "environment", name: "Environment", childIds: ["background"]),
            ],
            environment: "mountain-dusk",
            shots: [
                Shot(id: "shot-1", name: "Wide Shot", cameraNodeId: "camera-a", durationSec: 4),
                Shot(id: "shot-2", name: "Two Shot", cameraNodeId: "camera-b", durationSec: 4),
                Shot(id: "shot-3", name: "Close Up Host", cameraNodeId: "camera-c", durationSec: 4),
                Shot(id: "shot-4", name: "Close Up Guest", cameraNodeId: "camera-a", durationSec: 4),
                Shot(id: "shot-5", name: "Over Shoulder", cameraNodeId: "camera-b", durationSec: 4),
            ]
        )
    }
}
