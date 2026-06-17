import express from "express";
import type { Pool } from "pg";
import crypto from "crypto";
import { readString, readBoolean, readNumber } from "./_shared";

type CompatPaymentMethod = {
  id: string;
  payment_type: string;
  last_four: string | null;
  expiry_month: number | null;
  expiry_year: number | null;
  is_default: boolean;
  created_at: string;
  updated_at: string;
};

export interface UserRoutesDeps {
  app: express.Application;
  pool: Pool;
  compatResolveUserId: (req: any) => string;
  compatResolveUserEmail: (req: any) => string | null;
  compatScopedKey: (userId: string, key: string) => string;
  compatStoreSet: (key: string, value: unknown) => Promise<void>;
  compatStoreGet: <T>(key: string) => Promise<T | null>;
  compatStoreListByPrefix: <T>(
    prefix: string,
  ) => Promise<Array<{ key: string; value: T; updatedAt?: string }>>;
  dbCompatUiPreferencesKey: (userId: string) => string;
  dbCompatUserKvKey: (userId: string, key: string) => string;
  dbCompatUserKvPrefix: (userId: string) => string;
  dbCompatInterfacePreferencesKey: (sessionId: string) => string;
  getCompatUiPreferences: (userId: string) => Promise<Record<string, unknown>>;
  getDefaultInterfacePreferences: () => any;
  getUserIdFromAuth: (req: any) => string | null;
  isProtectedAcademyKvKey: (rawKey: unknown) => boolean;
  isRecord: (value: unknown) => value is Record<string, unknown>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  normalizeInterfacePreferencesRecord: (value: any) => any;
  readCompatPaymentMethods: (
    userId: string,
  ) => Promise<CompatPaymentMethod[]>;
  readCompatUserKvParamKey: (rawValue: unknown) => string | null;
  resolveCompatSubscriptionStatus: (
    userId: string,
    email: string | null,
  ) => Promise<any>;
  resolveUserKvScope: (req: express.Request) => {
    userId: string;
    authenticated: boolean;
  };
  writeCompatPaymentMethods: (
    userId: string,
    methods: CompatPaymentMethod[],
  ) => Promise<void>;
  collectCompatUserKvFromMemory: (userId: string) => Record<string, unknown>;
  compatUiPreferencesStore: Map<string, Record<string, unknown>>;
  compatUserKvStore: Map<string, { value: unknown; updatedAt: string }>;
  compatInterfacePreferencesStore: Map<string, any>;
}

export function setupUserRoutes(deps: UserRoutesDeps): void {
  const {
    app,
    pool,
    compatResolveUserId,
    compatResolveUserEmail,
    compatScopedKey,
    compatStoreSet,
    dbCompatUiPreferencesKey,
    dbCompatUserKvKey,
    dbCompatUserKvPrefix,
    dbCompatInterfacePreferencesKey,
    getCompatUiPreferences,
    getDefaultInterfacePreferences,
    getUserIdFromAuth,
    isProtectedAcademyKvKey,
    isRecord,
    normalizeInterfacePreferencesRecord,
    readCompatPaymentMethods,
    readCompatUserKvParamKey,
    resolveCompatSubscriptionStatus,
    resolveUserKvScope,
    writeCompatPaymentMethods,
    collectCompatUserKvFromMemory,
    compatUiPreferencesStore,
    compatUserKvStore,
    compatInterfacePreferencesStore,
    compatStoreGet,
    compatStoreListByPrefix,
  } = deps;

  app.get("/api/user/subscription-status", async (req, res) => {
    try {
      const userId = readString(req.query.userId) || compatResolveUserId(req);
      const email =
        readString(req.query.userEmail) || compatResolveUserEmail(req);
      const status = await resolveCompatSubscriptionStatus(
        userId || "guest",
        email,
      );
      res.json(status);
    } catch (error) {
      console.error("Error fetching subscription status:", error);
      res.status(500).json({ error: "Could not fetch subscription status" });
    }
  });

  app.get("/api/user/payment-methods", async (req, res) => {
    try {
      const userId = readString(req.query.userId) || compatResolveUserId(req);
      const paymentMethods = await readCompatPaymentMethods(userId || "guest");
      res.json({ paymentMethods });
    } catch (error) {
      console.error("Error fetching payment methods:", error);
      res.status(500).json({ error: "Could not fetch payment methods" });
    }
  });

  app.post("/api/user/payment-methods", async (req, res) => {
    try {
      const userId = compatResolveUserId(req);
      const body = isRecord(req.body) ? req.body : {};
      const paymentType =
        readString(body.paymentType) || readString(body.payment_type) || "card";
      const lastFour = readString(body.lastFour) || readString(body.last_four);
      const expiryMonth =
        readNumber(body.expiryMonth) || readNumber(body.expiry_month);
      const expiryYear =
        readNumber(body.expiryYear) || readNumber(body.expiry_year);
      const shouldBeDefault =
        readBoolean(body.isDefault ?? body.is_default) ?? false;
      const existing = await readCompatPaymentMethods(userId);
      const nowIso = new Date().toISOString();

      const createdMethod: CompatPaymentMethod = {
        id: crypto.randomUUID(),
        payment_type: paymentType,
        last_four: lastFour,
        expiry_month: expiryMonth,
        expiry_year: expiryYear,
        is_default: shouldBeDefault || existing.length === 0,
        created_at: nowIso,
        updated_at: nowIso,
      };

      const nextMethods = existing.map((method) => ({
        ...method,
        is_default: createdMethod.is_default ? false : method.is_default,
      }));
      nextMethods.push(createdMethod);
      await writeCompatPaymentMethods(userId, nextMethods);

      res
        .status(201)
        .json({ paymentMethod: createdMethod, paymentMethods: nextMethods });
    } catch (error) {
      console.error("Error creating payment method:", error);
      res.status(500).json({ error: "Could not create payment method" });
    }
  });

  app.put("/api/user/payment-methods/:id", async (req, res) => {
    try {
      const userId = compatResolveUserId(req);
      const methodId = readString(req.params.id);
      if (!methodId) {
        return res.status(400).json({ error: "Payment method id is required" });
      }

      const body = isRecord(req.body) ? req.body : {};
      const markDefault = readBoolean(body.isDefault ?? body.is_default);
      const methods = await readCompatPaymentMethods(userId);
      const exists = methods.some((method) => method.id === methodId);
      if (!exists) {
        return res.status(404).json({ error: "Payment method not found" });
      }

      const nextMethods = methods.map((method) => {
        if (method.id !== methodId) {
          return markDefault ? { ...method, is_default: false } : method;
        }
        return {
          ...method,
          is_default: markDefault ?? method.is_default,
          updated_at: new Date().toISOString(),
        };
      });

      await writeCompatPaymentMethods(userId, nextMethods);
      res.json({
        paymentMethod:
          nextMethods.find((method) => method.id === methodId) ?? null,
        paymentMethods: nextMethods,
      });
    } catch (error) {
      console.error("Error updating payment method:", error);
      res.status(500).json({ error: "Could not update payment method" });
    }
  });

  app.delete("/api/user/payment-methods/:id", async (req, res) => {
    try {
      const userId = compatResolveUserId(req);
      const methodId = readString(req.params.id);
      if (!methodId) {
        return res.status(400).json({ error: "Payment method id is required" });
      }

      const methods = await readCompatPaymentMethods(userId);
      const filtered = methods.filter((method) => method.id !== methodId);
      if (filtered.length === methods.length) {
        return res.status(404).json({ error: "Payment method not found" });
      }

      if (filtered.length > 0 && !filtered.some((method) => method.is_default)) {
        filtered[0] = {
          ...filtered[0],
          is_default: true,
          updated_at: new Date().toISOString(),
        };
      }

      await writeCompatPaymentMethods(userId, filtered);
      res.json({ success: true, paymentMethods: filtered });
    } catch (error) {
      console.error("Error deleting payment method:", error);
      res.status(500).json({ error: "Could not delete payment method" });
    }
  });

  const saveCompatUiPreferences = async (req: any, res: any) => {
    const userId = compatResolveUserId(req);
    const current = await getCompatUiPreferences(userId);
    const payload = req.body || {};
    const next: Record<string, unknown> = {
      ...current,
      ...payload,
      updatedAt: new Date().toISOString(),
    };

    if (payload.themeConfig && typeof payload.themeConfig === "object") {
      next.theme_config = payload.themeConfig;
    }
    if (payload.chatWidget && typeof payload.chatWidget === "object") {
      next.chat_widget = payload.chatWidget;
    }
    if (typeof payload.i18nLanguage === "string") {
      next.i18n_language = payload.i18nLanguage;
    }
    if (typeof payload.i18n_language === "string") {
      next.i18n_language = payload.i18n_language;
    }

    compatUiPreferencesStore.set(userId, next);
    await compatStoreSet(dbCompatUiPreferencesKey(userId), next);
    res.json({ success: true, data: next });
  };

  // User UI preferences (DB-compatible response shape used by multiple clients)
  app.get("/api/user/ui-preferences", async (req, res) => {
    const userId = compatResolveUserId(req);
    const data = await getCompatUiPreferences(userId);
    res.json({ success: true, data });
  });
  app.post("/api/user/ui-preferences", saveCompatUiPreferences);
  app.put("/api/user/ui-preferences", saveCompatUiPreferences);

  app.get("/api/user/kv", async (req, res) => {
    const { userId, authenticated } = resolveUserKvScope(req);
    const data = collectCompatUserKvFromMemory(userId);
    const filteredData = Object.fromEntries(
      Object.entries(data).filter(
        ([key]) => authenticated || !isProtectedAcademyKvKey(key),
      ),
    );

    try {
      const userPrefix = dbCompatUserKvPrefix(userId);
      const dbRows = await compatStoreListByPrefix<{
        value: unknown;
        updatedAt: string;
      }>(userPrefix);
      if (dbRows.length > 0) {
        for (const row of dbRows) {
          const scopedKey = row.key.slice(userPrefix.length);
          if (!scopedKey) continue;
          if (!authenticated && isProtectedAcademyKvKey(scopedKey)) {
            continue;
          }
          const entry = row.value;
          compatUserKvStore.set(compatScopedKey(userId, scopedKey), {
            value: entry?.value ?? null,
            updatedAt:
              typeof entry?.updatedAt === "string"
                ? entry.updatedAt
                : new Date().toISOString(),
          });
          filteredData[scopedKey] = entry?.value ?? null;
        }
      }
      return res.status(200).json({ success: true, data: filteredData });
    } catch (error) {
      console.warn("User KV list failed, returning memory fallback:", {
        userId,
        error,
      });
      return res.status(200).json({ success: true, data: filteredData });
    }
  });

  app.post("/api/user/kv", async (req, res) => {
    const { userId, authenticated } = resolveUserKvScope(req);
    const key = readString(req.body?.key);
    if (!key) {
      return res.status(400).json({ success: false, error: "key is required" });
    }
    if (!authenticated && isProtectedAcademyKvKey(key)) {
      return res
        .status(401)
        .json({ success: false, error: "Innlogging kreves for Academy-data" });
    }
    const scopedKey = compatScopedKey(userId, key);
    const entry = {
      value: req.body?.value ?? req.body?.data ?? null,
      updatedAt: new Date().toISOString(),
    };
    compatUserKvStore.set(scopedKey, entry);
    let persisted = true;
    try {
      await compatStoreSet(dbCompatUserKvKey(userId, key), entry);
    } catch (error) {
      persisted = false;
      console.warn("User KV write failed, kept in memory only:", {
        userId,
        key,
        error,
      });
    }
    res.status(200).json({
      success: true,
      key,
      value: entry.value,
      data: entry.value,
      updatedAt: entry.updatedAt,
      persisted,
    });
  });

  app.get("/api/user/kv/:key", async (req, res) => {
    const { userId, authenticated } = resolveUserKvScope(req);
    const key = readCompatUserKvParamKey(req.params.key);
    if (!key) {
      return res.status(400).json({ success: false, error: "key is required" });
    }
    if (!authenticated && isProtectedAcademyKvKey(key)) {
      return res
        .status(401)
        .json({ success: false, error: "Innlogging kreves for Academy-data" });
    }
    const scopedKey = compatScopedKey(userId, key);
    try {
      const dbEntry = await compatStoreGet<{ value: unknown; updatedAt: string }>(
        dbCompatUserKvKey(userId, key),
      );
      if (dbEntry && typeof dbEntry === "object") {
        compatUserKvStore.set(scopedKey, {
          value: dbEntry.value ?? null,
          updatedAt:
            typeof dbEntry.updatedAt === "string"
              ? dbEntry.updatedAt
              : new Date().toISOString(),
        });
      }
      const entry = dbEntry || compatUserKvStore.get(scopedKey);
      return res.status(200).json({
        success: true,
        key,
        value: entry?.value ?? null,
        data: entry?.value ?? null,
        updatedAt: entry?.updatedAt ?? null,
      });
    } catch (error) {
      console.warn("User KV read failed, returning memory fallback:", {
        userId,
        key,
        error,
      });
      const entry = compatUserKvStore.get(scopedKey);
      return res.status(200).json({
        success: true,
        key,
        value: entry?.value ?? null,
        data: entry?.value ?? null,
        updatedAt: entry?.updatedAt ?? null,
        persisted: false,
      });
    }
  });

  app.post("/api/user/kv/:key", async (req, res) => {
    const { userId, authenticated } = resolveUserKvScope(req);
    const key = readCompatUserKvParamKey(req.params.key);
    if (!key) {
      return res.status(400).json({ success: false, error: "key is required" });
    }
    if (!authenticated && isProtectedAcademyKvKey(key)) {
      return res
        .status(401)
        .json({ success: false, error: "Innlogging kreves for Academy-data" });
    }
    const scopedKey = compatScopedKey(userId, key);
    const entry = {
      value: req.body?.value ?? req.body?.data ?? null,
      updatedAt: new Date().toISOString(),
    };
    compatUserKvStore.set(scopedKey, entry);
    let persisted = true;
    try {
      await compatStoreSet(dbCompatUserKvKey(userId, key), entry);
    } catch (error) {
      persisted = false;
      console.warn("User KV param write failed, kept in memory only:", {
        userId,
        key,
        error,
      });
    }
    res.status(200).json({
      success: true,
      key,
      value: entry.value,
      data: entry.value,
      updatedAt: entry.updatedAt,
      persisted,
    });
  });

  app.get("/api/user/onboarding-status", (req, res) => {
    res.json({ needsOnboarding: false, completed: true, step: 0 });
  });

  app.get("/api/user/meeting-preferences", async (req, res) => {
    try {
      const userId = getUserIdFromAuth(req);
      const profession =
        typeof req.query.profession === "string" ? req.query.profession : null;
      const tableCheck = await pool.query(
        `SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'user_meeting_preferences')`,
      );
      if (!tableCheck.rows[0].exists) {
        return res.json({ meetingOption: "auto", meetingDuration: 60 });
      }

      let result;
      if (userId) {
        result = await pool.query(
          "SELECT * FROM user_meeting_preferences WHERE user_id = $1 ORDER BY created_at DESC LIMIT 1",
          [userId],
        );
      } else if (profession) {
        result = await pool.query(
          "SELECT * FROM user_meeting_preferences WHERE profession = $1 ORDER BY created_at DESC LIMIT 1",
          [profession],
        );
      } else {
        return res.json({ meetingOption: "auto", meetingDuration: 60 });
      }

      if (result.rowCount === 0) {
        return res.json({ meetingOption: "auto", meetingDuration: 60 });
      }

      const prefs = result.rows[0];
      res.json({
        meetingOption: prefs.meeting_option || "auto",
        meetingDuration: prefs.meeting_duration || 60,
        meetingTime: prefs.meeting_time || null,
        profession: prefs.profession || profession,
      });
    } catch (error) {
      console.error("Error fetching meeting preferences:", error);
      res.json({ meetingOption: "auto", meetingDuration: 60 });
    }
  });

  // POST /api/user/meeting-preferences — save meeting preferences
  app.post("/api/user/meeting-preferences", async (req, res) => {
    try {
      const userId = getUserIdFromAuth(req);
      const { meetingOption, meetingDuration, meetingTime, profession } =
        req.body;

      const tableCheck = await pool.query(
        `SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'user_meeting_preferences')`,
      );
      if (!tableCheck.rows[0].exists) {
        return res.json({ success: true });
      }

      // Delete existing preferences for this user, then insert fresh
      if (userId) {
        await pool.query(
          "DELETE FROM user_meeting_preferences WHERE user_id = $1",
          [userId],
        );
      }

      await pool.query(
        `INSERT INTO user_meeting_preferences (user_id, profession, meeting_option, meeting_duration, meeting_time, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, NOW(), NOW())`,
        [
          userId || "anonymous",
          profession || "photographer",
          meetingOption || "auto",
          meetingDuration || 60,
          meetingTime || null,
        ],
      );

      res.json({ success: true, message: "Møtepreferanser lagret" });
    } catch (error) {
      console.error("Error saving meeting preferences:", error);
      res.json({ success: true });
    }
  });

  app.get("/api/user/preferences/tutorial/:id", (req, res) => {
    res.json({ dismissed: false, progress: {} });
  });

  app.post("/api/user/preferences/tutorial-dismissal", (req, res) => {
    res.json({ success: true });
  });

  app.patch("/api/user/preferences/tutorial/:id/progress", (req, res) => {
    res.json({ success: true });
  });

  app.get("/api/user/interface-preferences/:sessionId", async (req, res) => {
    const { sessionId } = req.params;
    const fromCompatMemory = compatInterfacePreferencesStore.get(sessionId);
    if (fromCompatMemory) {
      return res.json({
        success: true,
        preferences: fromCompatMemory,
        source: "compat-store",
      });
    }

    const fromCompatDb = await compatStoreGet<Record<string, unknown>>(
      dbCompatInterfacePreferencesKey(sessionId),
    );
    if (fromCompatDb && typeof fromCompatDb === "object") {
      compatInterfacePreferencesStore.set(sessionId, fromCompatDb);
      return res.json({
        success: true,
        preferences: fromCompatDb,
        source: "compat-store",
      });
    }

    try {
      const prefs = await pool.query<Record<string, unknown>>(
        `SELECT id, user_id, preferences, theme, language, timezone, notifications, dashboard, created_at, updated_at
         FROM user_preferences
         WHERE user_id = $1
         ORDER BY updated_at DESC NULLS LAST, created_at DESC NULLS LAST
         LIMIT 1`,
        [sessionId],
      );

      if (prefs.rows.length > 0) {
        const normalized = normalizeInterfacePreferencesRecord(prefs.rows[0]);
        compatInterfacePreferencesStore.set(sessionId, normalized);
        await compatStoreSet(
          dbCompatInterfacePreferencesKey(sessionId),
          normalized,
        );
        return res.json({
          success: true,
          preferences: normalized,
          source: "database",
        });
      }

      // Return defaults if no preferences found
      res.json({
        success: true,
        preferences: getDefaultInterfacePreferences(),
        source: "defaults",
      });
    } catch (error) {
      console.error("Error fetching interface preferences:", error);
      res.json({
        success: true,
        preferences: getDefaultInterfacePreferences(),
        source: "defaults",
      });
    }
  });

  // Save user interface preferences
  app.put("/api/user/interface-preferences/:sessionId", async (req, res) => {
    const { sessionId } = req.params;
    const preferences = req.body;
    const compatNext = {
      ...(compatInterfacePreferencesStore.get(sessionId) || {}),
      ...(preferences || {}),
      updatedAt: new Date().toISOString(),
    };
    compatInterfacePreferencesStore.set(sessionId, compatNext);
    await compatStoreSet(dbCompatInterfacePreferencesKey(sessionId), compatNext);

    try {
      const normalized = {
        ...getDefaultInterfacePreferences(),
        ...(preferences || {}),
      };
      const dashboardPayload = {
        layout: normalized.dashboardLayout,
      };
      const notificationsPayload = {
        enabled: normalized.notificationsEnabled,
      };
      const preferencesPayload = {
        theme: normalized.theme,
        language: normalized.language,
        notificationsEnabled: normalized.notificationsEnabled,
        dashboardLayout: normalized.dashboardLayout,
        timezone: normalized.timezone,
        currency: normalized.currency,
      };

      try {
        // Single atomic upsert — race-free under concurrency (the old
        // SELECT-then-UPDATE/INSERT could double-insert or lose updates when
        // several saves for the same user overlapped). Relies on the UNIQUE
        // index user_preferences(user_id) from migration 004.
        await pool.query(
          `INSERT INTO user_preferences (
            id, user_id, preferences, theme, language, timezone, notifications, dashboard, created_at, updated_at
          ) VALUES (
            $1, $2, $3::jsonb, $4, $5, $6, $7::jsonb, $8::jsonb, NOW(), NOW()
          )
          ON CONFLICT (user_id) DO UPDATE SET
            theme = EXCLUDED.theme,
            language = EXCLUDED.language,
            timezone = EXCLUDED.timezone,
            notifications = EXCLUDED.notifications,
            dashboard = EXCLUDED.dashboard,
            preferences = EXCLUDED.preferences,
            updated_at = NOW()`,
          [
            crypto.randomUUID(),
            sessionId,
            JSON.stringify(preferencesPayload),
            normalized.theme,
            normalized.language,
            normalized.timezone,
            JSON.stringify(notificationsPayload),
            JSON.stringify(dashboardPayload),
          ],
        );
      } catch (upsertErr) {
        // 42P10 = no unique/exclusion constraint matching ON CONFLICT. A few
        // legacy envs never got migration 004's unique index, so fall back to
        // the read-modify-write path there rather than dropping the DB write.
        if ((upsertErr as { code?: string })?.code !== "42P10") throw upsertErr;
        const existing = await pool.query<{ id: string }>(
          `SELECT id
             FROM user_preferences
            WHERE user_id = $1
            ORDER BY updated_at DESC NULLS LAST, created_at DESC NULLS LAST
            LIMIT 1`,
          [sessionId],
        );
        if (existing.rows.length > 0) {
          await pool.query(
            `UPDATE user_preferences
                SET theme = $2, language = $3, timezone = $4,
                    notifications = $5::jsonb, dashboard = $6::jsonb,
                    preferences = $7::jsonb, updated_at = NOW()
              WHERE id = $1`,
            [
              existing.rows[0].id,
              normalized.theme,
              normalized.language,
              normalized.timezone,
              JSON.stringify(notificationsPayload),
              JSON.stringify(dashboardPayload),
              JSON.stringify(preferencesPayload),
            ],
          );
        } else {
          await pool.query(
            `INSERT INTO user_preferences (
              id, user_id, preferences, theme, language, timezone, notifications, dashboard, created_at, updated_at
            ) VALUES (
              $1, $2, $3::jsonb, $4, $5, $6, $7::jsonb, $8::jsonb, NOW(), NOW()
            )`,
            [
              crypto.randomUUID(),
              sessionId,
              JSON.stringify(preferencesPayload),
              normalized.theme,
              normalized.language,
              normalized.timezone,
              JSON.stringify(notificationsPayload),
              JSON.stringify(dashboardPayload),
            ],
          );
        }
      }

      res.json({
        success: true,
        message: "Preferences saved to database",
        source: "database",
      });
    } catch (error) {
      console.error(
        "Error saving interface preferences to DB, using compatibility store:",
        error,
      );
      res.json({
        success: true,
        message: "Preferences saved to compatibility store",
        source: "compat-store",
      });
    }
  });
}
