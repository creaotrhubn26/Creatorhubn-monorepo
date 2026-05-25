import express from "express";
import type { Pool } from "pg";
import { readString } from "./_shared";

export interface UserPreferencesRoutesDeps {
  app: express.Application;
  pool: Pool;
  compatStoreGet: <T>(key: string) => Promise<T | null>;
  compatStoreSet: (key: string, value: unknown) => Promise<void>;
  dbCompatSpeedDialPreferenceKey: (preferenceKey: string) => string;
  speedDialPreferencesFallbackStore: Map<string, any>;
}

export function setupUserPreferencesRoutes(
  deps: UserPreferencesRoutesDeps,
): void {
  const {
    app,
    pool,
    compatStoreGet,
    compatStoreSet,
    dbCompatSpeedDialPreferenceKey,
    speedDialPreferencesFallbackStore,
  } = deps;

  function getSpeedDialPreferenceKey(
    sessionId: string,
    profession: string,
  ): string {
    return `${sessionId}::${profession}`;
  }

  app.get(
    "/api/user-preferences/:sessionId/:profession",
    async (req, res) => {
      const sessionId = readString(req.params.sessionId);
      const profession =
        readString(req.params.profession) || "photographer";

      if (!sessionId) {
        return res.status(400).json({ error: "sessionId is required" });
      }

      const preferenceKey = getSpeedDialPreferenceKey(sessionId, profession);

      try {
        const result = await pool.query(
          `SELECT session_id, speed_dial_order, hidden_actions
           FROM admin_smart_preferences
           WHERE session_id = $1
           LIMIT 1`,
          [preferenceKey],
        );

        if (!result.rows.length) {
          const dbFallback = await compatStoreGet<{
            sessionId: string;
            profession: string;
            speedDialOrder: string[];
            hiddenActions: string[];
          }>(dbCompatSpeedDialPreferenceKey(preferenceKey));
          if (dbFallback) {
            speedDialPreferencesFallbackStore.set(preferenceKey, dbFallback);
          }
          const fallback =
            dbFallback ||
            speedDialPreferencesFallbackStore.get(preferenceKey);
          if (fallback) {
            return res.json({ ...fallback, isDefault: false });
          }
          return res.json({
            sessionId,
            profession,
            speedDialOrder: [],
            hiddenActions: [],
            isDefault: true,
          });
        }

        const row = result.rows[0] as Record<string, unknown>;
        res.json({
          sessionId,
          profession,
          speedDialOrder: Array.isArray(row.speed_dial_order)
            ? row.speed_dial_order
            : [],
          hiddenActions: Array.isArray(row.hidden_actions)
            ? row.hidden_actions
            : [],
          isDefault: false,
        });
      } catch (error) {
        console.error("Error fetching user preferences:", error);
        const dbFallback = await compatStoreGet<{
          sessionId: string;
          profession: string;
          speedDialOrder: string[];
          hiddenActions: string[];
        }>(dbCompatSpeedDialPreferenceKey(preferenceKey));
        if (dbFallback) {
          speedDialPreferencesFallbackStore.set(preferenceKey, dbFallback);
        }
        const fallback =
          dbFallback ||
          speedDialPreferencesFallbackStore.get(preferenceKey);
        if (fallback) {
          return res.json({ ...fallback, isDefault: false });
        }
        res.json({
          sessionId,
          profession,
          speedDialOrder: [],
          hiddenActions: [],
          isDefault: true,
        });
      }
    },
  );

  app.post("/api/user-preferences", async (req, res) => {
    const sessionId = readString(req.body?.sessionId);
    const profession =
      readString(req.body?.profession) || "photographer";
    const speedDialOrder = Array.isArray(req.body?.speedDialOrder)
      ? req.body.speedDialOrder
      : [];
    const hiddenActions = Array.isArray(req.body?.hiddenActions)
      ? req.body.hiddenActions
      : [];

    if (!sessionId) {
      return res.status(400).json({ error: "sessionId is required" });
    }

    const preferenceKey = getSpeedDialPreferenceKey(sessionId, profession);
    const payload = {
      sessionId,
      profession,
      speedDialOrder: speedDialOrder.filter(
        (item: unknown): item is string => typeof item === "string",
      ),
      hiddenActions: hiddenActions.filter(
        (item: unknown): item is string => typeof item === "string",
      ),
    };

    try {
      await pool.query(
        `INSERT INTO admin_smart_preferences (id, session_id, speed_dial_order, hidden_actions, updated_at)
         VALUES (gen_random_uuid(), $1, $2::jsonb, $3::jsonb, NOW())
         ON CONFLICT (session_id)
         DO UPDATE SET
           speed_dial_order = EXCLUDED.speed_dial_order,
           hidden_actions = EXCLUDED.hidden_actions,
           updated_at = NOW()`,
        [
          preferenceKey,
          JSON.stringify(payload.speedDialOrder),
          JSON.stringify(payload.hiddenActions),
        ],
      );

      speedDialPreferencesFallbackStore.set(preferenceKey, payload);
      await compatStoreSet(
        dbCompatSpeedDialPreferenceKey(preferenceKey),
        payload,
      );
      res.json({ success: true, ...payload });
    } catch (error) {
      console.error("Error saving user preferences:", error);
      speedDialPreferencesFallbackStore.set(preferenceKey, payload);
      await compatStoreSet(
        dbCompatSpeedDialPreferenceKey(preferenceKey),
        payload,
      );
      res.json({ success: true, ...payload });
    }
  });
}
