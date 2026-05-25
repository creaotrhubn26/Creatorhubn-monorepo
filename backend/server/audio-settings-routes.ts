import express from "express";
import { readString } from "./_shared";

export interface AudioSettingsRoutesDeps {
  app: express.Application;
}

export function setupAudioSettingsRoutes(
  deps: AudioSettingsRoutesDeps,
): void {
  const { app } = deps;

  const duckingPresetStore: Array<Record<string, unknown>> = [];
  const eqPresetStore: Array<Record<string, unknown>> = [];
  const mixerSettingsStore: Array<Record<string, unknown>> = [];

  app.get("/api/audio-settings/ducking-presets", (_req, res) => {
    res.json({ presets: duckingPresetStore });
  });

  app.post("/api/audio-settings/ducking-presets", (req, res) => {
    const preset = req.body || {};
    const stored = { ...preset, id: duckingPresetStore.length + 1 };
    duckingPresetStore.push(stored);
    res.json({ success: true, preset: stored });
  });

  app.delete(
    "/api/audio-settings/ducking-presets/:id",
    (req, res) => {
      const id = Number(req.params.id);
      const index = duckingPresetStore.findIndex(
        (preset: any) => preset.id === id,
      );
      if (index >= 0) duckingPresetStore.splice(index, 1);
      res.json({ success: true });
    },
  );

  app.get("/api/audio-settings/eq-presets", (_req, res) => {
    res.json({ presets: eqPresetStore });
  });

  app.post("/api/audio-settings/eq-presets", (req, res) => {
    const preset = req.body || {};
    const stored = { ...preset, id: eqPresetStore.length + 1 };
    eqPresetStore.push(stored);
    res.json({ success: true, preset: stored });
  });

  app.get("/api/audio-settings/mixer-settings", (req, res) => {
    const projectId = readString(req.query.projectId);
    const trackId = readString(req.query.trackId);
    const settings = mixerSettingsStore.filter((setting: any) => {
      if (projectId && String(setting.projectId) !== projectId) return false;
      if (trackId && String(setting.trackId) !== trackId) return false;
      return true;
    });
    res.json({ settings });
  });

  app.post("/api/audio-settings/mixer-settings", (req, res) => {
    const settings = req.body || {};
    const stored = { ...settings, id: mixerSettingsStore.length + 1 };
    mixerSettingsStore.push(stored);
    res.json({ success: true, settings: stored });
  });
}
