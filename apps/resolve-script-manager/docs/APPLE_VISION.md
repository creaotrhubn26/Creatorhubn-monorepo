# Apple Vision i Post Agent (macOS)

Hvordan ta i bruk **Apple Vision.framework** (på-enhet computer vision) i Post
Agent. Vision er **gratis, raskt, privat og uten API-kost** — kjører lokalt på
Mac-en. Passer perfekt siden appen allerede shell-er ut til Python-scripts;
samme mønster brukes for en Swift Vision-sidecar.

> Status: **plan / anbefaling** (2026-07-02). Ikke implementert ennå.
> Skrevet ut fra PetKey-arbeidet (auto-reframe 9:16, culling, B-roll, thumbnails).

---

## 1. Integrasjons-måter

| # | Metode | Innsats | Notat |
|---|--------|---------|-------|
| **A** | **Swift Vision-sidecar CLI** ✅ anbefalt | Lav | Liten Swift-CLI: bilde/frame + request → JSON. Tauri kaller den som bundlet sidecar, akkurat som `executeScript` kaller Python. Matcher eksisterende arkitektur. |
| B | Rust → Vision direkte | Høy | `objc2` + `objc2-vision`-crates. Ingen egen binær, men mye FFI. |
| C | Swift Package → dylib | Middels | Kompiler til dylib, link inn i Rust-binæren. |

**Velg A.** Resten av dokumentet forutsetter sidecar-tilnærmingen.

---

## 2. Hva Vision kan drive i Post Agent

| Vision-request | Feature |
|---|---|
| `VNDetectFaceRectanglesRequest` + `VNDetectHumanBodyPoseRequest` + `VNGenerate*SaliencyImageRequest` | **Auto-reframe 9:16** — spor ansikt/motiv pr frame, hold sentrert i vertikal crop (gratis på-enhet-alternativ til YOLO i social-pipelinen) |
| `VNDetectFaceLandmarksRequest` + `VNDetectFaceCaptureQualityRequest` | **Culling** — øyne åpne, uskarphet, ansikts-kvalitet → velg beste frames/bilder |
| `VNClassifyImageRequest` + saliency + `VNGenerateObjectnessBasedSaliencyImageRequest` | **B-roll-analyse** — tags/scene (komplement til Claude-vision, men gratis/rask/offline) |
| `VNRecognizeTextRequest` (OCR) | Les skjerm-tekst / slates / app-skjerm (f.eks. PetKey-appen) |
| `VNGenerateForegroundInstanceMaskRequest` (macOS 14+) | Motiv-cutout / bakgrunns-blur / thumbnails / compositing |
| Attention-saliency | **Cover/thumbnail-valg** — mest blikkfangende frame |

---

## 3. Minimal starter — `vision_cli.swift`

```swift
import Vision
import AppKit
import Foundation

// bruk: vision_cli <bilde> <request: faces|saliency|text|mask>
let path = CommandLine.arguments[1]
let mode = CommandLine.arguments.count > 2 ? CommandLine.arguments[2] : "faces"
guard let img = NSImage(contentsOfFile: path),
      let cg = img.cgImage(forProposedRect: nil, context: nil, hints: nil) else {
    FileHandle.standardError.write("kan ikke lese bilde\n".data(using: .utf8)!); exit(1)
}
let handler = VNImageRequestHandler(cgImage: cg, options: [:])
var out: [String: Any] = [:]

switch mode {
case "faces":
    let r = VNDetectFaceRectanglesRequest(); try handler.perform([r])
    out["faces"] = (r.results ?? []).map {
        ["x": $0.boundingBox.minX, "y": $0.boundingBox.minY,
         "w": $0.boundingBox.width, "h": $0.boundingBox.height]
    }
case "saliency":
    let r = VNGenerateAttentionBasedSaliencyImageRequest(); try handler.perform([r])
    if let obs = r.results?.first as? VNSaliencyImageObservation,
       let sal = obs.salientObjects?.first {
        out["salient"] = ["x": sal.boundingBox.minX, "y": sal.boundingBox.minY,
                          "w": sal.boundingBox.width, "h": sal.boundingBox.height]
    }
case "text":
    let r = VNRecognizeTextRequest(); r.recognitionLevel = .accurate
    r.recognitionLanguages = ["no", "en"]; try handler.perform([r])
    out["text"] = (r.results ?? []).compactMap { $0.topCandidates(1).first?.string }
case "mask":  // macOS 14+
    if #available(macOS 14.0, *) {
        let r = VNGenerateForegroundInstanceMaskRequest(); try handler.perform([r])
        out["instances"] = r.results?.first?.allInstances.count ?? 0
    }
default: break
}
print(String(data: try JSONSerialization.data(withJSONObject: out), encoding: .utf8)!)
```

Merk: koordinatene er **normaliserte (0–1) med origo nederst-venstre** (Vision-
konvensjon) — konverter til piksler / top-left ved behov.

---

## 4. Bygg + bundle (Tauri sidecar)

```bash
# bygg universal binær
swiftc -O vision_cli.swift -o vision_cli
# (evt. universal: bygg arm64 + x86_64 og lipo sammen)
```

1. Legg binæren i Tauri `externalBin` (sidecar) i `tauri.conf.json`, med
   plattform-suffiks (`vision_cli-aarch64-apple-darwin`).
2. Kall fra Rust via `tauri_plugin_shell` Command / sidecar, eller wrap i et
   registrert «script» slik at frontend kan kalle den via samme
   `executeScript`-mønster.
3. Parse JSON i UI (samme som andre script-resultater).

**Entitlements/signering:** Vision krever ingen spesielle entitlements for
lokal bilde-analyse. Sidecar-binæren må være signert som en del av app-bundlet
(Tauri gjør dette ved `tauri build`). For kamera/live-video trengs
`NSCameraUsageDescription`, men frame-analyse fra fil trenger det ikke.

---

## 5. Video: analyser frames

Vision jobber pr **bilde**. For video:
1. Trekk ut frames med ffmpeg (`-vf fps=…`) eller `AVAssetImageGenerator` i Swift.
2. Kjør Vision pr frame (batch i samme Swift-prosess for fart — unngå oppstart
   pr frame).
3. Aggreger (f.eks. motiv-senter pr frame → glatt bane → auto-reframe keyframes).

For **auto-reframe 9:16**: face/body/saliency pr frame → glatt X/Y-bane (unngå
hopp) → skriv Resolve Transform-keyframes (Zoom/Position) via scripting.

---

## 6. Anbefalt rekkefølge (faser)

1. **`vision_cli`-sidecar** med `faces` + `saliency` + `text` + `mask` (JSON-ut).
2. **Wire som script** + lite panel (samme mønster som `music_duck_balance`).
3. **Første feature: Culling** (face + capture-quality) ELLER **auto-reframe 9:16**
   (face/saliency-spor → Transform-keyframes) — begge har direkte verdi.
4. Utvid: B-roll-tags, OCR av app-skjerm, motiv-cutout for thumbnails.

---

## Relaterte
- Social-vertikal-pipeline (auto-reframe): `scripts/social/svb_*`
- B-roll-analyse (Claude vision i dag): `scripts/social/analyze_broll_clip.py`
- Script-mønster å kopiere: `scripts/social/music_duck_balance.py`
