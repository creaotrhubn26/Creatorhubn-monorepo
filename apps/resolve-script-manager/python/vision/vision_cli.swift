// vision_cli — Apple Vision-sidecar for Post Agent (på-enhet CV, gratis/offline).
//
// Kalles direkte av Python-scriptene (samme mønster som ffmpeg), så alt
// degraderer pent hvis binæren mangler.
//
// Bruk:
//   vision_cli image <bilde> [--requests faces,pose,quality,saliency,text]
//   vision_cli video <video> [--fps 3] [--max-frames 3600]
//                             [--requests pose,quality,saliency]
//
// Utgang: JSON på stdout.
//   image → { faces:[...], persons:[{arms_raised,horizontal,conf}], face_quality,
//             salient:[x,y,w,h], text:[...] }
//   video → { fps, frames:[{ t, persons, arms_raised, fall, face_quality,
//             salient:[x,y,w,h] }] }
//
// Koordinater er normaliserte (0–1), origo nederst-venstre (Vision-konvensjon).

import Vision
import AVFoundation
import CoreImage
import Foundation

#if canImport(AppKit)
import AppKit
#endif

// ---------- felles ----------

func jointName(_ j: VNHumanBodyPoseObservation.JointName) -> VNHumanBodyPoseObservation.JointName { j }

struct PoseFlags { var armsRaised = false; var horizontal = false; var conf: Float = 0 }

func analyzePose(_ obs: VNHumanBodyPoseObservation) -> PoseFlags {
    var out = PoseFlags()
    guard let pts = try? obs.recognizedPoints(.all) else { return out }
    func p(_ j: VNHumanBodyPoseObservation.JointName) -> VNRecognizedPoint? {
        if let pt = pts[j], pt.confidence > 0.3 { return pt }
        return nil
    }
    out.conf = obs.confidence
    // armer opp (triumf): begge håndledd over sine respektive skuldre
    if let lw = p(.leftWrist), let rw = p(.rightWrist), let ls = p(.leftShoulder), let rs = p(.rightShoulder) {
        out.armsRaised = lw.location.y > ls.location.y && rw.location.y > rs.location.y
    }
    // horisontal torso (fall): skulder→hofte-vektor mer horisontal enn vertikal
    if let ls = p(.leftShoulder), let rs = p(.rightShoulder), let lh = p(.leftHip), let rh = p(.rightHip) {
        let sx = (ls.location.x + rs.location.x) / 2, sy = (ls.location.y + rs.location.y) / 2
        let hx = (lh.location.x + rh.location.x) / 2, hy = (lh.location.y + rh.location.y) / 2
        out.horizontal = abs(hx - sx) > abs(hy - sy) * 1.2
    }
    return out
}

func runRequests(_ handler: VNImageRequestHandler, _ reqs: Set<String>)
    -> (persons: [PoseFlags], faceQ: Float, salient: [Double], faces: Int, text: [String], scene: [[String: Any]]) {
    var persons: [PoseFlags] = []
    var faceQ: Float = 0
    var salient: [Double] = []
    var faces = 0
    var text: [String] = []
    var scene: [[String: Any]] = []

    if reqs.contains("pose") {
        let r = VNDetectHumanBodyPoseRequest()
        if (try? handler.perform([r])) != nil, let obs = r.results {
            persons = obs.map(analyzePose)
        }
    }
    if reqs.contains("quality") || reqs.contains("faces") {
        let r = VNDetectFaceCaptureQualityRequest()
        if (try? handler.perform([r])) != nil, let obs = r.results {
            faces = obs.count
            for f in obs { if let q = f.faceCaptureQuality { faceQ = max(faceQ, q) } }
        }
    }
    if reqs.contains("saliency") {
        let r = VNGenerateAttentionBasedSaliencyImageRequest()
        if (try? handler.perform([r])) != nil,
           let obs = r.results?.first as? VNSaliencyImageObservation,
           let s = obs.salientObjects?.first {
            let b = s.boundingBox
            salient = [Double(b.minX), Double(b.minY), Double(b.width), Double(b.height)]
        }
    }
    if reqs.contains("text") {
        let r = VNRecognizeTextRequest()
        r.recognitionLevel = .accurate
        r.recognitionLanguages = ["no", "en"]
        if (try? handler.perform([r])) != nil, let obs = r.results {
            text = obs.compactMap { $0.topCandidates(1).first?.string }
        }
    }
    if reqs.contains("classify") || reqs.contains("scene") {
        let r = VNClassifyImageRequest()
        if (try? handler.perform([r])) != nil, let obs = r.results {
            scene = obs.filter { $0.confidence > 0.12 }.prefix(4)
                .map { ["label": $0.identifier, "conf": Double($0.confidence)] }
        }
    }
    return (persons, faceQ, salient, faces, text, scene)
}

func emit(_ obj: Any) {
    if let d = try? JSONSerialization.data(withJSONObject: obj),
       let s = String(data: d, encoding: .utf8) { print(s) }
}

func fail(_ msg: String) -> Never {
    FileHandle.standardError.write((msg + "\n").data(using: .utf8)!); exit(1)
}

// ---------- arg-parse ----------

let args = CommandLine.arguments
guard args.count >= 3 else { fail("bruk: vision_cli <image|video> <sti> [--fps N] [--requests ...]") }
let mode = args[1]
let path = args[2]
var fps = 3.0
var maxFrames = 3600
var reqStr = mode == "video" ? "pose,quality,saliency" : "faces,pose,quality,saliency,text"
var i = 3
while i < args.count {
    switch args[i] {
    case "--fps": if i + 1 < args.count { fps = Double(args[i + 1]) ?? fps; i += 1 }
    case "--max-frames": if i + 1 < args.count { maxFrames = Int(args[i + 1]) ?? maxFrames; i += 1 }
    case "--requests": if i + 1 < args.count { reqStr = args[i + 1]; i += 1 }
    default: break
    }
    i += 1
}
let reqs = Set(reqStr.split(separator: ",").map { String($0) })

// ---------- image ----------

if mode == "image" {
    #if canImport(AppKit)
    guard let img = NSImage(contentsOfFile: path),
          let cg = img.cgImage(forProposedRect: nil, context: nil, hints: nil)
    else { fail("kan ikke lese bilde: \(path)") }
    #else
    fail("image-modus krever AppKit")
    #endif
    let handler = VNImageRequestHandler(cgImage: cg, options: [:])
    let r = runRequests(handler, reqs)
    emit([
        "faces": r.faces,
        "face_quality": Double(r.faceQ),
        "persons": r.persons.map { ["arms_raised": $0.armsRaised, "horizontal": $0.horizontal, "conf": Double($0.conf)] },
        "arms_raised": r.persons.filter { $0.armsRaised }.count,
        "horizontal": r.persons.filter { $0.horizontal }.count,
        "salient": r.salient,
        "text": r.text,
        "scene": r.scene,
    ])
    exit(0)
}

// ---------- video ----------

if mode == "video" {
    let asset = AVURLAsset(url: URL(fileURLWithPath: path))
    let gen = AVAssetImageGenerator(asset: asset)
    gen.appliesPreferredTrackTransform = true
    gen.requestedTimeToleranceBefore = CMTime(seconds: 0.1, preferredTimescale: 600)
    gen.requestedTimeToleranceAfter = CMTime(seconds: 0.1, preferredTimescale: 600)

    var frames: [[String: Any]] = []
    let step = 1.0 / max(0.5, fps)
    var t = 0.0
    var n = 0
    while n < maxFrames {
        let time = CMTime(seconds: t, preferredTimescale: 600)
        guard let cg = try? gen.copyCGImage(at: time, actualTime: nil) else { break }
        let handler = VNImageRequestHandler(cgImage: cg, options: [:])
        let r = runRequests(handler, reqs)
        frames.append([
            "t": t,
            "persons": r.persons.count,
            "arms_raised": r.persons.filter { $0.armsRaised }.count,
            "fall": r.persons.filter { $0.horizontal }.count,
            "face_quality": Double(r.faceQ),
            "salient": r.salient,
            "scene": r.scene.first.map { [$0["label"] as? String ?? ""] } ?? [],
        ])
        t += step; n += 1
    }
    emit(["fps": fps, "frames": frames])
    exit(0)
}

fail("ukjent modus: \(mode)")
