# StageOne fase 3 — Export

**Dato:** 2026-08-07. Bygger på fase 2 (PR #1943). Kilde: `virtual-studio-export.html`.

## Skjermen

- **Preview:** live `CameraTileView` av valgt kamera + kamera-chips (frame-velgeren
  fra prototypen, men mot ekte kamera-noder).
- **Innstillinger:** Format = Video (.mp4, H.264, AVAssetWriter) | Still Frame (.png)
  | USDZ («Kommer»-badge, deaktivert). Range = Full sequence (alle shots,
  kamera-klipp per shot) | Current shot (valgt shot-chip). Oppløsning
  4K 3840×2160 / 1080p / 720p. FPS 24/30/60 (kun video). Størrelses-estimat
  (prototypens heuristikk: `px-faktor · fps/30 · sek · 25 MB`).
- **Kjøring:** ekte fremdrifts-bar (frames skrevet / totalt), avbrytbar, Export-knapp
  disabled under kjøring.
- **Historikk:** de FAKTISKE filene i `Documents/exports/` (navn · meta · dato),
  ShareLink per rad. Tom-tilstand som prototypen.

## ExportEngine

```
@Observable @MainActor final class ExportEngine {
    var isExporting; var progress: Double
    func exportStill(scene, cameraNodeId, width, height, renderer) throws -> URL
    func exportVideo(scene, shots-range, width, height, fps, renderer) async throws -> URL
    func cancel()
    static func listExports() -> [ExportRecord]   // fra filsystemet
}
```

- Frame-loop: elapsed = i/fps → shot-index (delt hjelper m/ ShotPlayer) → kamera →
  `renderOffscreen` → CVPixelBuffer (BGRA, pool fra adaptor) → append m/
  CMTime(i, fps). `Task.yield()` per frame (UI puster). PNG via CGImage (som
  renderer-testene).
- Filnavn: `StageOne-<hva>-yyyyMMdd-HHmmss.<ext>`.

## Testing

Still → PNG eksisterer m/ riktige piksel-dimensjoner. Video (0.5s, 160×90, 12fps)
→ .mp4 eksisterer, `AVAsset` har video-track og varighet ≈ 0.5s. Full suite + sim-
screenshot av skjermen.

## Ikke i fase 3

USDZ, lyd, HEVC/ProRes-valg, DOF i render, eksport av AR-ankere.
