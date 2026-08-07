# StageOne fase 6 — AR-preview + RoomPlan (siste fase)

**Dato:** 2026-08-07. Bygger på fase 5 (PR #1948). Ingen backend-endringer.

## AR-preview

«AR Preview»-chipen i Studio → fullskjerm `ARPreviewSheet`:
- `ARView` m/ horisontal plan-deteksjon; tap = raycast → plasser/flytt anker,
  pinch = skaler (0.02–1.0, default 1:10).
- `RealityScene.makeRoot`: én entitet per enabled node. Geometri = **egen
  MeshFactory** via `MeshDescriptor` (identisk look som Metal-viewporten,
  iOS 17-trygt); farger fra `StageRenderer.baseColor`; spot-lys → `SpotLight`
  m/ Kelvin-farge + beam-vinkel, area → `PointLight`. Rotasjonsrekkefølge
  matcher `float4x4.model` (Ry·Rx·Rz).
- Gated `ARWorldTrackingConfiguration.isSupported` — sim/ustøttet enhet får
  «krever ekte iPad»-tilstand.

## RoomPlan-skann

«Scan Room»-kortet i hierarkiet → fullskjerm `RoomScanSheet`
(`RoomCaptureView`, gated `RoomCaptureSession.isSupported`):
- Ferdig skann → `RoomScanImporter`: vegger/dører/vinduer = tynne bokser m/
  ekte dimensjoner, gulv = plan, objekter = bokser; posisjon fra transform,
  yaw ekstrahert (ponytail: kun yaw — RoomPlan-flater er vertikalt akse-
  alignerte). Åpninger hoppes over.
- Alt inn i gruppe «scanned-room» i ÉN mutate (én undo); **nytt skann
  erstatter forrige** (gruppen byttes ut).
- Konverteringen tar rene structs (`ScannedSurface`) — testbar uten LiDAR;
  det tynne `CapturedRoom`-uttrekket bor i sheet-fila.
- 🔑 Swift 6-feller løst: RoomCaptureViewDelegate arver NSCoding (stubs +
  `@objc`-navn) og krever `@preconcurrency`-konformans for MainActor-klasse.

## Felles

`NSCameraUsageDescription` i Info.plist. Skannede noder overlever
Codable-roundtrip (sky-synk fase 4 tar dem gratis).

## Testing

50/50: RealityScene (entitet per enabled node, transform-mapping, mesh for
alle kinds), RoomScanImporter (mapping/yaw/erstatning/roundtrip) + hele suiten.
**Ekte AR/LiDAR-adferd krever fysisk iPad (TestFlight)** — sim viser gated
fallback-tilstander.

## Ikke i fase 6

AR-okklusjon/skygger, gange-rundt-persistens (ankeret re-plasseres per tap),
RoomPlan-tekstur/USDZ-eksport, auto-innplassering av studiooppsettet i skannet rom.
