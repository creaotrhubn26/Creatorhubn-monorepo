/**
 * role-room-casting-poster-archive-routes.ts
 *
 * Backend-mottaker for casting-call-postere generert client-side
 * (html2canvas → PNG). Frontend POST-er multipart med projectId, roleId,
 * variantId og PNG-blob; vi lagrer til the-role-room-prod-bucketen.
 *
 * Path: casting-call-posters/{projectId}/{roleId}-{variant}.png
 * Endepunkt: POST /api/role-room/admin/casting-posters/save
 *
 * Gating: kun produkteier (samme requireAdminSession som b2-archive).
 * Selv om feature er aktuell for fotografer/produsenter, brukes denne
 * arkivkanalen kun av Daniel for langtidsarkiv av postere — fotografer
 * har egne lagringsflater for delte postere.
 */

import express from "express";
import multer from "multer";
import { archiveToRoleRoomB2, slugifyForKey } from "./b2-archive-helper.js";

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10 MiB — postere er typisk 200-800 KiB
});

interface CastingPosterArchiveDeps {
  app: express.Application;
  requireAdminSession: (req: any, res: any) => any;
}

export function registerCastingPosterArchiveRoutes(deps: CastingPosterArchiveDeps): void {
  const { app, requireAdminSession } = deps;

  app.post(
    "/api/role-room/admin/casting-posters/save",
    upload.single("poster"),
    async (req, res) => {
      if (!requireAdminSession(req, res)) return;

      const file = (req as any).file as Express.Multer.File | undefined;
      if (!file) {
        return res.status(400).json({ error: "Mangler 'poster' file-felt i multipart" });
      }
      if (!file.mimetype.startsWith("image/")) {
        return res.status(400).json({ error: `Avvist filtype: ${file.mimetype}` });
      }

      const body = (req.body ?? {}) as Record<string, string>;
      const projectId = slugifyForKey(body.projectId ?? "ukjent-prosjekt");
      const roleId = slugifyForKey(body.roleId ?? "ukjent-rolle");
      const variant = slugifyForKey(body.variant ?? "standard");

      const key = `casting-call-posters/${projectId}/${roleId}-${variant}.png`;

      const result = await archiveToRoleRoomB2(key, file.buffer, file.mimetype);
      if (!result) {
        return res.status(503).json({
          error: "B2 ikke konfigurert — poster ikke arkivert",
          downloadOnly: true,
        });
      }
      return res.json({
        archived: true,
        bucket: result.bucket,
        key: result.key,
        sizeBytes: result.size,
      });
    },
  );
}
