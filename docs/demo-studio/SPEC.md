# Product Demo Studio — spec (kort)

Scene-basert produktvideo-verktøy i Post Agent (Tauri). URL → mockup-preview →
scener (manus + handling) → guided opptak (manuell progresjon) → eksport.

## 5-sone-layout (piksel-fasit: cream/lyst Newsletter-Studio-design)
1. Venstre sidebar: Create Demo, Flow Builder, Script Builder, Guided Recorder,
   Device Preview, Export. Bunn: prosjekt, profil, plan, settings.
2. Topbar: prosjekt-tittel + Draft/autosave, søk, samarbeidspartnere,
   URL-state, Preview, Save, Export (mørk knapp).
3. Andre panel: scene-blokker / insert.
4. Senter: device-mockup preview (Mac/iPad/iPhone) + device-toggle.
5. Høyre: Scene settings — tabs Guide / Script / Notes (teleprompter).
6. Bunn: scene-timeline med status-kort.

## Kjernekrav
- Scene-basert (ikke ett langt opptak).
- Manuell progresjon: Next Step / Mark Done / Retake — venter alltid på bruker.
- Mac+iPad+iPhone i samme video. URL er startpunkt.
- Datamodell: Project/Scene/Action/ExportPreset (se demoStudioModel.ts).

Full spec: gitt av Daniel 2026-06-02 (chat).
