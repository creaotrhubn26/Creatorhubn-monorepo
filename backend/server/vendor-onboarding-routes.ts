import express from "express";
import type { Pool } from "pg";
import crypto from "crypto";
import { and, eq } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import * as schema from "../migrations/schema.js";
import { readBoolean, readString, readStringArray } from "./_shared";

export interface VendorOnboardingRoutesDeps {
  app: express.Application;
  requireUserSession: (req: any, res: any) => any;
  pool: Pool;
  db: NodePgDatabase<typeof schema>;
  isValidNorwegianOrgNumber: (value: string) => boolean;
  getTableColumns: (tableName: string) => Promise<Set<string>>;
  normalizeBase64Upload: (
    base64: string,
    fileName: string,
  ) => { dataUrl: string; mimeType: string; size: number };
}

export function setupVendorOnboardingRoutes(
  deps: VendorOnboardingRoutesDeps,
): void {
  const {
    app,
    requireUserSession,
    pool,
    db,
    isValidNorwegianOrgNumber,
    getTableColumns,
    normalizeBase64Upload,
  } = deps;

  app.post("/api/vendor-onboarding/validate-org", async (req, res) => {
    if (!requireUserSession(req, res)) return;
    try {
      const organizationNumber = readString(req.body?.organizationNumber);
      if (!organizationNumber) {
        return res
          .status(400)
          .json({ isValid: false, error: "Organisasjonsnummer mangler" });
      }

      if (!isValidNorwegianOrgNumber(organizationNumber)) {
        return res
          .status(200)
          .json({ isValid: false, error: "Ugyldig organisasjonsnummer" });
      }

      let companyName: string | undefined;
      try {
        const columns = await getTableColumns("users");
        const orgColumn = columns.has("organization_number")
          ? "organization_number"
          : columns.has("organizationNumber")
            ? "organizationNumber"
            : null;
        const companyColumn = columns.has("company_name")
          ? "company_name"
          : columns.has("companyName")
            ? "companyName"
            : columns.has("company")
              ? "company"
              : null;

        if (orgColumn && companyColumn) {
          const result = await pool.query(
            `select ${companyColumn} as company_name from users where ${orgColumn} = $1 limit 1`,
            [organizationNumber],
          );
          companyName = result.rows?.[0]?.company_name || undefined;
        }
      } catch (lookupError) {
        console.warn("Org validation lookup error:", lookupError);
      }

      return res.json({
        isValid: true,
        companyName,
      });
    } catch (error) {
      console.error("Org validation error:", error);
      return res.status(500).json({
        isValid: false,
        error: "Kunne ikke validere organisasjonsnummer",
      });
    }
  });

  app.post("/api/vendor-onboarding/upload-logo", async (req, res) => {
    if (!requireUserSession(req, res)) return;
    try {
      const userId = readString(req.body?.userId);
      const vendorType = readString(req.body?.vendorType);
      const fileName = readString(req.body?.fileName) || "vendor-logo.png";
      const logoBase64 = readString(req.body?.logoBase64);

      if (!userId || !vendorType || !logoBase64) {
        return res
          .status(400)
          .json({ success: false, error: "Manglende data for logo-upload" });
      }

      const normalized = normalizeBase64Upload(logoBase64, fileName);
      const filePath = `vendor-logos/${userId}/${Date.now()}-${fileName}`;

      const storedFileUrl = normalized.dataUrl;
      const storedFileName = fileName;

      try {
        const columns = await getTableColumns("user_files");
        const insertColumns = [
          "id",
          "user_id",
          "file_name",
          "file_path",
          "file_type",
          "file_size",
          "mime_type",
          "metadata",
        ].filter((column) => columns.has(column));

        if (columns.has("file_url")) {
          insertColumns.splice(4, 0, "file_url");
        }

        if (insertColumns.length > 0) {
          const id = crypto.randomUUID();
          const values = insertColumns.map((column) => {
            switch (column) {
              case "id":
                return id;
              case "user_id":
                return userId;
              case "file_name":
                return fileName;
              case "file_path":
                return filePath;
              case "file_url":
                return normalized.dataUrl;
              case "file_type":
                return "vendor_logo";
              case "file_size":
                return String(normalized.size);
              case "mime_type":
                return normalized.mimeType;
              case "metadata":
                return JSON.stringify({ vendorType });
              default:
                return null;
            }
          });

          const placeholders = insertColumns
            .map((_, index) => `$${index + 1}`)
            .join(", ");
          const query = `insert into user_files (${insertColumns.join(", ")}) values (${placeholders})`;
          await pool.query(query, values);
        }
      } catch (insertError) {
        console.warn("Logo upload persistence warning:", insertError);
      }

      return res.json({
        success: true,
        logoUrl: storedFileUrl,
        fileName: storedFileName,
      });
    } catch (error) {
      console.error("Logo upload error:", error);
      return res
        .status(500)
        .json({ success: false, error: "Kunne ikke laste opp logo" });
    }
  });

  app.post("/api/vendor-onboarding/complete", async (req, res) => {
    if (!requireUserSession(req, res)) return;
    try {
      const vendorType = readString(req.body?.vendorType);
      const vendorName = readString(req.body?.vendorName);
      const userId = readString(req.body?.userId);
      const onboardingData = req.body?.onboardingData || {};

      if (!vendorType || !vendorName || !userId) {
        return res
          .status(400)
          .json({ error: "vendorType, vendorName og userId er påkrevd" });
      }

      const now = new Date().toISOString();
      const standardKeys = new Set([
        "organizationNumber",
        "businessName",
        "contactEmail",
        "website",
        "phone",
        "description",
        "logoUrl",
        "logoFileName",
        "categories",
        "paymentMethods",
        "currency",
        "taxId",
        "shippingRegions",
        "turnaroundTime",
        "fikenEnabled",
        "termsAccepted",
        "readyToLaunch",
      ]);

      const businessInfo = {
        organizationNumber: readString(onboardingData.organizationNumber),
        businessName:
          readString(onboardingData.businessName) || vendorName,
        contactEmail: readString(onboardingData.contactEmail),
        website: readString(onboardingData.website),
        phone: readString(onboardingData.phone),
        description: readString(onboardingData.description),
        logoUrl: readString(onboardingData.logoUrl),
        logoFileName: readString(onboardingData.logoFileName),
        categories: readStringArray(onboardingData.categories),
        paymentMethods: readString(onboardingData.paymentMethods),
        currency: readString(onboardingData.currency),
        taxId: readString(onboardingData.taxId),
        shippingRegions: readString(onboardingData.shippingRegions),
        turnaroundTime: readString(onboardingData.turnaroundTime),
        fikenEnabled: readBoolean(onboardingData.fikenEnabled) ?? false,
        termsAccepted: readBoolean(onboardingData.termsAccepted) ?? false,
        readyToLaunch: readBoolean(onboardingData.readyToLaunch) ?? false,
      };

      const vendorSpecificData = Object.fromEntries(
        Object.entries(onboardingData).filter(
          ([key]) => !standardKeys.has(key),
        ),
      );

      const isComplete = Boolean(
        businessInfo.termsAccepted && businessInfo.readyToLaunch,
      );
      const completedAt = isComplete ? now : null;

      const [existingProfile] = await db
        .select({ id: schema.vendorOnboardingProfiles.id })
        .from(schema.vendorOnboardingProfiles)
        .where(
          and(
            eq(schema.vendorOnboardingProfiles.userId, userId),
            eq(schema.vendorOnboardingProfiles.vendorType, vendorType),
          ),
        )
        .limit(1);

      let profileId = existingProfile?.id;

      if (existingProfile?.id) {
        await db
          .update(schema.vendorOnboardingProfiles)
          .set({
            vendorName,
            businessInfo,
            vendorSpecificData,
            isComplete,
            completedAt,
            updatedAt: now,
          } as any)
          .where(eq(schema.vendorOnboardingProfiles.id, existingProfile.id));
      } else {
        profileId = crypto.randomUUID();
        await db.insert(schema.vendorOnboardingProfiles).values({
          id: profileId,
          userId,
          vendorType,
          vendorName,
          businessInfo,
          vendorSpecificData,
          isComplete,
          completedAt,
          createdAt: now,
          updatedAt: now,
        } as any);
      }

      const contactInfo = {
        email: businessInfo.contactEmail,
        phone: businessInfo.phone,
        website: businessInfo.website,
      };

      const [existingVendor] = await db
        .select({ id: schema.vendors.id })
        .from(schema.vendors)
        .where(
          and(
            eq(schema.vendors.userId, userId),
            eq(schema.vendors.vendorType, vendorType),
          ),
        )
        .limit(1);

      let vendorId = existingVendor?.id;

      if (existingVendor?.id) {
        await db
          .update(schema.vendors)
          .set({
            vendorName,
            contactInfo,
            businessInfo,
            updatedAt: now,
          } as any)
          .where(eq(schema.vendors.id, existingVendor.id));
      } else {
        vendorId = crypto.randomUUID();
        await db.insert(schema.vendors).values({
          id: vendorId,
          userId,
          vendorName,
          vendorType,
          contactInfo,
          businessInfo,
          createdAt: now,
          updatedAt: now,
        } as any);
      }

      return res.json({
        status: isComplete ? "completed" : "saved",
        vendorId,
        onboardingProfileId: profileId,
      });
    } catch (error) {
      console.error("Vendor onboarding completion error:", error);
      return res
        .status(500)
        .json({ error: "Kunne ikke fullfoere onboarding" });
    }
  });
}
