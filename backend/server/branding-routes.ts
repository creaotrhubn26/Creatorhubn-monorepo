import express from "express";
import type { Pool } from "pg";
import type { Multer } from "multer";
import { readString } from "./_shared";

export interface BrandingRoutesDeps {
  app: express.Application;
  pool: Pool;
  requireUserSession: (req: any, res: any) => any;
  brandingLogoUpload: Multer;
  getStoredBusinessBrandingInfo: (userId: string) => Promise<any>;
  persistBusinessBrandingInfo: (
    userId: string,
    patch: any,
  ) => Promise<any>;
  normalizeBusinessBrandingInfo: (input: any) => any;
  toBusinessBrandingResponse: (branding: any, stored: any) => any;
  resolveDocumentBranding: (
    pool: Pool,
    userId: string,
    overrides: any,
  ) => Promise<any>;
  persistBrandingLogoAsset: (params: {
    userId: string;
    fileName: string;
    dataUrl: string;
    mimeType: string;
    size: number;
  }) => Promise<void>;
  resolveMimeType: (fileName?: string | null) => string;
  getStoredRoleRoomPlatformBrandingSettings: (
    userId?: string,
  ) => Promise<any>;
  persistRoleRoomPlatformBrandingSettings: (
    settings: any,
    userId: string,
  ) => Promise<any>;
  roleRoomBrandingSettingsUserId: string;
}

export function setupBrandingRoutes(deps: BrandingRoutesDeps): void {
  const {
    app,
    pool,
    requireUserSession,
    brandingLogoUpload,
    getStoredBusinessBrandingInfo,
    persistBusinessBrandingInfo,
    normalizeBusinessBrandingInfo,
    toBusinessBrandingResponse,
    resolveDocumentBranding,
    persistBrandingLogoAsset,
    resolveMimeType,
    getStoredRoleRoomPlatformBrandingSettings,
    persistRoleRoomPlatformBrandingSettings,
    roleRoomBrandingSettingsUserId,
  } = deps;

  app.get("/api/branding/business-info", async (req, res) => {
    const userId =
      readString(req.query.userId) ||
      readString(req.query.user_id) ||
      readString(req.headers["x-user-id"]);
    const profession = readString(req.query.profession);

    if (!userId) {
      res.status(400).json({ error: "userId is required" });
      return;
    }

    try {
      const storedBranding = await getStoredBusinessBrandingInfo(userId);
      const branding = await resolveDocumentBranding(pool, userId, {
        businessName: storedBranding.businessName,
        email: storedBranding.email,
        phone: storedBranding.phone,
        website: storedBranding.website,
        businessAddress: storedBranding.businessAddress,
        organizationNumber: storedBranding.organizationNumber,
        vatNumber: storedBranding.vatNumber,
        tagline: storedBranding.tagline,
        accentColor: storedBranding.brandingColor,
        logoUrl: storedBranding.customLogo,
        businessDescription: storedBranding.businessDescription,
        customFooterText: storedBranding.customFooterText,
      });

      res.json({
        businessInfo: toBusinessBrandingResponse(branding, {
          ...storedBranding,
          profession: profession || storedBranding.profession || "",
        }),
        source: branding.source,
      });
    } catch (error) {
      console.error("Branding business info lookup failed:", error);
      res
        .status(500)
        .json({ error: "Failed to load branding business info" });
    }
  });

  app.put("/api/branding/business-info/:userId", async (req, res) => {
    if (!requireUserSession(req, res)) return;
    const userId = readString(req.params.userId);
    if (!userId) {
      res.status(400).json({ error: "userId is required" });
      return;
    }

    try {
      const normalized = normalizeBusinessBrandingInfo(req.body);
      normalized.profession =
        readString(req.body?.profession) ||
        normalized.profession ||
        readString(req.headers["x-profession"]) ||
        null;

      const stored = await persistBusinessBrandingInfo(userId, normalized);
      const branding = await resolveDocumentBranding(pool, userId, {
        businessName: stored.businessName,
        email: stored.email,
        phone: stored.phone,
        website: stored.website,
        businessAddress: stored.businessAddress,
        organizationNumber: stored.organizationNumber,
        vatNumber: stored.vatNumber,
        tagline: stored.tagline,
        accentColor: stored.brandingColor,
        logoUrl: stored.customLogo,
        businessDescription: stored.businessDescription,
        customFooterText: stored.customFooterText,
      });

      res.json({
        ok: true,
        businessInfo: toBusinessBrandingResponse(branding, stored),
        source: branding.source,
      });
    } catch (error) {
      console.error("Branding business info update failed:", error);
      res
        .status(500)
        .json({ error: "Failed to update branding business info" });
    }
  });

  app.post(
    "/api/branding/upload-logo",
    brandingLogoUpload.single("logo"),
    async (req, res) => {
      if (!requireUserSession(req, res)) return;
      const userId =
        readString(req.body?.userId) ||
        readString(req.body?.user_id) ||
        readString(req.headers["x-user-id"]);

      if (!userId || !req.file) {
        res.status(400).json({ error: "userId and logo are required" });
        return;
      }

      try {
        const fileName =
          readString(req.file.originalname) || "branding-logo.png";
        const mimeType = req.file.mimetype || resolveMimeType(fileName);
        const dataUrl = `data:${mimeType};base64,${req.file.buffer.toString("base64")}`;
        const stored = await persistBusinessBrandingInfo(userId, {
          customLogo: dataUrl,
          profession: readString(req.body?.profession),
        });

        await persistBrandingLogoAsset({
          userId,
          fileName,
          dataUrl,
          mimeType,
          size: req.file.size,
        });

        res.json({
          success: true,
          logoUrl: stored.customLogo || dataUrl,
          fileName,
        });
      } catch (error) {
        console.error("Branding logo upload failed:", error);
        res.status(500).json({ error: "Failed to upload branding logo" });
      }
    },
  );

  app.delete("/api/branding/logo/:userId", async (req, res) => {
    if (!requireUserSession(req, res)) return;
    const userId = readString(req.params.userId);
    if (!userId) {
      res.status(400).json({ error: "userId is required" });
      return;
    }

    try {
      const stored = await persistBusinessBrandingInfo(userId, {
        customLogo: null,
        profession: readString(req.query.profession),
      });
      const branding = await resolveDocumentBranding(pool, userId, {
        businessName: stored.businessName,
        email: stored.email,
        phone: stored.phone,
        website: stored.website,
        businessAddress: stored.businessAddress,
        organizationNumber: stored.organizationNumber,
        vatNumber: stored.vatNumber,
        tagline: stored.tagline,
        accentColor: stored.brandingColor,
        logoUrl: stored.customLogo,
        businessDescription: stored.businessDescription,
        customFooterText: stored.customFooterText,
      });

      res.json({
        ok: true,
        businessInfo: toBusinessBrandingResponse(branding, stored),
        source: branding.source,
      });
    } catch (error) {
      console.error("Branding logo delete failed:", error);
      res.status(500).json({ error: "Failed to delete branding logo" });
    }
  });

  app.get("/api/branding/settings", async (req, res) => {
    try {
      const userId =
        readString(req.query.userId) ||
        readString(req.query.user_id) ||
        readString(req.headers["x-user-id"]) ||
        roleRoomBrandingSettingsUserId;
      const stored =
        await getStoredRoleRoomPlatformBrandingSettings(userId);
      res.json({
        settings: stored,
      });
    } catch {
      res.json({ settings: {} });
    }
  });

  app.put("/api/branding/settings", async (req, res) => {
    if (!requireUserSession(req, res)) return;
    try {
      const userId =
        readString(req.body?.userId) ||
        readString(req.body?.user_id) ||
        readString(req.headers["x-user-id"]) ||
        roleRoomBrandingSettingsUserId;
      const normalized = await persistRoleRoomPlatformBrandingSettings(
        req.body?.settings,
        userId,
      );
      res.json({ ok: true, settings: normalized });
    } catch (error) {
      console.error("Role Room branding settings update failed:", error);
      res
        .status(500)
        .json({ error: "Failed to update branding settings" });
    }
  });
}
