import express from "express";
import { readString } from "./_shared";

export interface AudioSettingsRoutesDeps {
  app: express.Application;
  requireUserSession: (req: any, res: any) => any;
}

// Stores er in-memory (nullstilles ved restart). De var tidligere globale —
// alle innloggede brukere så/slettet hverandres presets. Nå stemples hver rad
// med __ownerUserId = session.userId og GET/DELETE filtreres på den, så en
// bruker kun ser og kan slette sine egne. (Full DB-persistering med user_id-
// kolonne er fortsatt et separat fremtidig løft; dette lukker cross-user-
// lekkasjen/manipulasjonen uten migration.)
export function setupAudioSettingsRoutes(
  deps: AudioSettingsRoutesDeps,
): void {
  const { app, requireUserSession } = deps;

  const duckingPresetStore: Array<Record<string, unknown>> = [];
  const eqPresetStore: Array<Record<string, unknown>> = [];
  const mixerSettingsStore: Array<Record<string, unknown>> = [];

  const ownedBy = (row: any, userId: string) =>
    String(row?.__ownerUserId ?? "") === String(userId);

  app.get("/api/audio-settings/ducking-presets", (req, res) => {
    const session = requireUserSession(req, res);
    if (!session) return;
    res.json({
      presets: duckingPresetStore.filter((p) => ownedBy(p, session.userId)),
    });
  });

  app.post("/api/audio-settings/ducking-presets", (req, res) => {
    const session = requireUserSession(req, res);
    if (!session) return;
    const preset = req.body || {};
    const stored = {
      ...preset,
      id: duckingPresetStore.length + 1,
      __ownerUserId: session.userId,
    };
    duckingPresetStore.push(stored);
    res.json({ success: true, preset: stored });
  });

  app.delete(
    "/api/audio-settings/ducking-presets/:id",
    (req, res) => {
      const session = requireUserSession(req, res);
      if (!session) return;
      const id = Number(req.params.id);
      const index = duckingPresetStore.findIndex(
        (preset: any) => preset.id === id && ownedBy(preset, session.userId),
      );
      if (index >= 0) duckingPresetStore.splice(index, 1);
      res.json({ success: true });
    },
  );

  app.get("/api/audio-settings/eq-presets", (req, res) => {
    const session = requireUserSession(req, res);
    if (!session) return;
    res.json({
      presets: eqPresetStore.filter((p) => ownedBy(p, session.userId)),
    });
  });

  app.post("/api/audio-settings/eq-presets", (req, res) => {
    const session = requireUserSession(req, res);
    if (!session) return;
    const preset = req.body || {};
    const stored = {
      ...preset,
      id: eqPresetStore.length + 1,
      __ownerUserId: session.userId,
    };
    eqPresetStore.push(stored);
    res.json({ success: true, preset: stored });
  });

  app.get("/api/audio-settings/mixer-settings", (req, res) => {
    const session = requireUserSession(req, res);
    if (!session) return;
    const projectId = readString(req.query.projectId);
    const trackId = readString(req.query.trackId);
    const settings = mixerSettingsStore.filter((setting: any) => {
      if (!ownedBy(setting, session.userId)) return false;
      if (projectId && String(setting.projectId) !== projectId) return false;
      if (trackId && String(setting.trackId) !== trackId) return false;
      return true;
    });
    res.json({ settings });
  });

  app.post("/api/audio-settings/mixer-settings", (req, res) => {
    const session = requireUserSession(req, res);
    if (!session) return;
    const settings = req.body || {};
    const stored = {
      ...settings,
      id: mixerSettingsStore.length + 1,
      __ownerUserId: session.userId,
    };
    mixerSettingsStore.push(stored);
    res.json({ success: true, settings: stored });
  });
}
