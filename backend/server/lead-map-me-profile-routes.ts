/**
 * Leadgrid self-service profile.
 *
 * The authenticated session is the only source of the user id. Email is an
 * authentication identifier and profile_image_url is storage-owned, so neither
 * can be changed by the ordinary PATCH route.
 */

import crypto from "node:crypto";
import type { Express, Request, Response } from "express";
import multer from "multer";
import type { Pool } from "pg";

type SessionData = { userId: string; role?: string; email?: string };

interface Deps {
  app: Express;
  pool: Pool;
  activeSessions: Map<string, SessionData>;
  uploadImage?: (buffer: Buffer, mimeType: string, key: string) => Promise<string>;
  deleteImage?: (key: string) => Promise<void>;
}

interface ProfileRow {
  user_id: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  phone: string | null;
  profession: string | null;
  profile_image_url: string | null;
}

type EditableProfileField = "first_name" | "last_name" | "phone" | "profession";
type ProfileUpdate = { column: string; value: string | null };

export class ProfileValidationError extends Error {
  constructor(public readonly fields: Record<string, string>) {
    super("Ugyldige profilfelt");
    this.name = "ProfileValidationError";
  }
}

const editableFields = new Set<EditableProfileField>([
  "first_name",
  "last_name",
  "phone",
  "profession",
]);

const databaseColumn: Record<EditableProfileField, string> = {
  first_name: "first_name",
  last_name: "last_name",
  phone: "phone_number",
  profession: "profession",
};

const maxLength: Record<EditableProfileField, number> = {
  first_name: 80,
  last_name: 80,
  phone: 32,
  profession: 120,
};

function getSession(
  req: Request,
  sessions: Map<string, SessionData>,
): SessionData | null {
  const auth = req.headers.authorization;
  if (auth?.startsWith("Bearer ")) {
    return sessions.get(auth.substring(7)) ?? null;
  }
  const token = (req as Request & { cookies?: { sessionToken?: string } }).cookies
    ?.sessionToken;
  return token ? sessions.get(token) ?? null : null;
}

function normalizeEditableValue(
  field: EditableProfileField,
  value: unknown,
  errors: Record<string, string>,
): string | null | undefined {
  if (value === null) return null;
  if (typeof value !== "string") {
    errors[field] = "Må være tekst.";
    return undefined;
  }

  const normalized = value.trim();
  if (!normalized) return null;
  if (normalized.length > maxLength[field]) {
    errors[field] = "Kan ha maksimalt " + maxLength[field] + " tegn.";
    return undefined;
  }
  if (/\p{C}/u.test(normalized)) {
    errors[field] = "Inneholder ugyldige kontrolltegn.";
    return undefined;
  }
  if (field === "phone") {
    const digits = normalized.replace(/\D/g, "");
    if (!/^[+0-9().\-\s]+$/.test(normalized) || digits.length < 5 || digits.length > 15) {
      errors.phone = "Skriv et gyldig telefonnummer.";
      return undefined;
    }
  }
  return normalized;
}

export function parseProfileUpdate(body: unknown): ProfileUpdate[] {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    throw new ProfileValidationError({ form: "Ugyldig forespørsel." });
  }

  const record = body as Record<string, unknown>;
  const errors: Record<string, string> = {};
  const updates: ProfileUpdate[] = [];

  for (const key of Object.keys(record)) {
    if (key === "email") {
      errors.email = "E-post må endres gjennom en verifisert kontoflyt.";
      continue;
    }
    if (key === "profile_image_url") {
      errors.profile_image_url = "Profilbilde må lastes opp gjennom bildevelgeren.";
      continue;
    }
    if (!editableFields.has(key as EditableProfileField)) {
      errors[key] = "Ukjent profilfelt.";
      continue;
    }
    const field = key as EditableProfileField;
    const value = normalizeEditableValue(field, record[field], errors);
    if (value !== undefined) {
      updates.push({ column: databaseColumn[field], value });
    }
  }

  if (Object.keys(errors).length > 0) throw new ProfileValidationError(errors);
  if (updates.length === 0) {
    throw new ProfileValidationError({ form: "Ingen profilfelt å oppdatere." });
  }
  return updates;
}

export function shapeProfile(row: ProfileRow) {
  const required = [
    Boolean(row.profile_image_url?.trim()),
    Boolean(row.email?.trim()),
    Boolean(row.phone?.trim()),
    Boolean(row.profession?.trim()),
  ];
  const completedCount = required.filter(Boolean).length;
  return {
    user_id: row.user_id,
    first_name: row.first_name,
    last_name: row.last_name,
    email: row.email,
    phone: row.phone,
    profession: row.profession,
    profile_image_url: row.profile_image_url,
    profile_complete: completedCount === required.length,
    profile_completed_count: completedCount,
    profile_total_required: required.length,
  };
}

const profileColumns =
  "id AS user_id, first_name, last_name, email, " +
  "phone_number AS phone, profession, profile_image_url";

const imageUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 4 * 1024 * 1024, files: 1 },
  fileFilter: (_req, file, callback) => {
    const accepted = new Set(["image/jpeg", "image/jpg", "image/png", "image/webp"]);
    if (accepted.has(file.mimetype)) {
      callback(null, true);
    } else {
      callback(new Error("unsupported_image_type"));
    }
  },
});

function detectedImageType(buffer: Buffer): { mime: string; extension: string } | null {
  if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return { mime: "image/jpeg", extension: "jpg" };
  }
  if (
    buffer.length >= 8 &&
    buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))
  ) {
    return { mime: "image/png", extension: "png" };
  }
  if (
    buffer.length >= 12 &&
    buffer.subarray(0, 4).toString("ascii") === "RIFF" &&
    buffer.subarray(8, 12).toString("ascii") === "WEBP"
  ) {
    return { mime: "image/webp", extension: "webp" };
  }
  return null;
}

function ownedProfileImageKey(rawURL: string | null, userId: string): string | null {
  if (!rawURL) return null;
  try {
    const pathname = decodeURIComponent(new URL(rawURL).pathname).replace(/^\/+/, "");
    const prefix = "leadgrid/profile-images/" + userId + "/";
    const index = pathname.indexOf(prefix);
    if (index < 0) return null;
    const key = pathname.slice(index);
    const filename = key.slice(prefix.length);
    return /^[a-f0-9]{16}\.(jpg|png|webp)$/.test(filename) ? key : null;
  } catch {
    return null;
  }
}

function validationResponse(res: Response, error: unknown): boolean {
  if (!(error instanceof ProfileValidationError)) return false;
  res.status(422).json({ error: "validation_error", fields: error.fields });
  return true;
}

export function registerLeadMapMeProfileRoutes({
  app,
  pool,
  activeSessions,
  uploadImage,
  deleteImage,
}: Deps): void {
  app.get("/api/admin-room/lead-map/me/profile", async (req, res) => {
    const session = getSession(req, activeSessions);
    if (!session) return res.status(401).json({ error: "Ikke innlogget" });

    try {
      const result = await pool.query<ProfileRow>(
        "SELECT " + profileColumns + " FROM users WHERE id = $1",
        [session.userId],
      );
      if (result.rows.length === 0) {
        return res.status(404).json({ error: "Bruker ikke funnet" });
      }
      return res.json({ profile: shapeProfile(result.rows[0]) });
    } catch (error) {
      console.error("[leadgrid] me/profile GET failed", error);
      return res.status(500).json({ error: "profile_fetch_failed" });
    }
  });

  app.patch("/api/admin-room/lead-map/me/profile", async (req, res) => {
    const session = getSession(req, activeSessions);
    if (!session) return res.status(401).json({ error: "Ikke innlogget" });

    let updates: ProfileUpdate[];
    try {
      updates = parseProfileUpdate(req.body);
    } catch (error) {
      if (validationResponse(res, error)) return;
      return res.status(400).json({ error: "invalid_request" });
    }

    const values: Array<string | null> = updates.map((update) => update.value);
    const clauses = updates.map((update, index) => update.column + " = $" + (index + 1));
    values.push(session.userId);

    try {
      const result = await pool.query<ProfileRow>(
        "UPDATE users SET " + clauses.join(", ") + ", updated_at = now() " +
          "WHERE id = $" + values.length + " RETURNING " + profileColumns,
        values,
      );
      if (result.rows.length === 0) {
        return res.status(404).json({ error: "Bruker ikke funnet" });
      }
      return res.json({ profile: shapeProfile(result.rows[0]) });
    } catch (error) {
      console.error("[leadgrid] me/profile PATCH failed", error);
      return res.status(500).json({ error: "profile_update_failed" });
    }
  });

  app.post("/api/admin-room/lead-map/me/profile/image", (req, res) => {
    const session = getSession(req, activeSessions);
    if (!session) {
      res.status(401).json({ error: "Ikke innlogget" });
      return;
    }
    if (!uploadImage) {
      res.status(503).json({ error: "image_upload_unavailable" });
      return;
    }

    imageUpload.single("image")(req, res, (uploadError) => {
      if (uploadError) {
        const tooLarge = uploadError instanceof multer.MulterError && uploadError.code === "LIMIT_FILE_SIZE";
        res.status(tooLarge ? 413 : 415).json({
          error: tooLarge ? "image_too_large" : "unsupported_image_type",
        });
        return;
      }

      void (async () => {
        const file = (req as Request & { file?: Express.Multer.File }).file;
        if (!file) {
          res.status(400).json({ error: "missing_image" });
          return;
        }
        const detected = detectedImageType(file.buffer);
        if (!detected) {
          res.status(415).json({ error: "unsupported_image_type" });
          return;
        }

        const hash = crypto.createHash("sha256").update(file.buffer).digest("hex").slice(0, 16);
        const key = "leadgrid/profile-images/" + session.userId + "/" + hash + "." + detected.extension;
        let uploaded = false;
        let previousKey: string | null = null;
        try {
          const current = await pool.query<{ profile_image_url: string | null }>(
            "SELECT profile_image_url FROM users WHERE id = $1",
            [session.userId],
          );
          if (current.rows.length === 0) {
            res.status(404).json({ error: "Bruker ikke funnet" });
            return;
          }
          previousKey = ownedProfileImageKey(
            current.rows[0].profile_image_url,
            session.userId,
          );
          const url = await uploadImage(file.buffer, detected.mime, key);
          uploaded = true;
          const result = await pool.query<ProfileRow>(
            "UPDATE users SET profile_image_url = $1, updated_at = now() " +
              "WHERE id = $2 RETURNING " + profileColumns,
            [url, session.userId],
          );
          if (result.rows.length === 0) {
            if (deleteImage && previousKey !== key) await deleteImage(key);
            res.status(404).json({ error: "Bruker ikke funnet" });
            return;
          }
          if (deleteImage && previousKey && previousKey !== key) {
            try {
              await deleteImage(previousKey);
            } catch (cleanupError) {
              console.error("[leadgrid] previous profile image cleanup failed", cleanupError);
            }
          }
          res.json({ profile: shapeProfile(result.rows[0]) });
        } catch (error) {
          if (uploaded && deleteImage && previousKey !== key) {
            try {
              await deleteImage(key);
            } catch (cleanupError) {
              console.error("[leadgrid] failed upload cleanup failed", cleanupError);
            }
          }
          console.error("[leadgrid] profile image upload failed", error);
          res.status(500).json({ error: "image_upload_failed" });
        }
      })();
    });
  });

  app.delete("/api/admin-room/lead-map/me/profile/image", async (req, res) => {
    const session = getSession(req, activeSessions);
    if (!session) return res.status(401).json({ error: "Ikke innlogget" });
    try {
      const current = await pool.query<{ profile_image_url: string | null }>(
        "SELECT profile_image_url FROM users WHERE id = $1",
        [session.userId],
      );
      if (current.rows.length === 0) {
        return res.status(404).json({ error: "Bruker ikke funnet" });
      }
      const key = ownedProfileImageKey(current.rows[0].profile_image_url, session.userId);
      const result = await pool.query<ProfileRow>(
        "UPDATE users SET profile_image_url = NULL, updated_at = now() " +
          "WHERE id = $1 RETURNING " + profileColumns,
        [session.userId],
      );
      if (result.rows.length === 0) {
        return res.status(404).json({ error: "Bruker ikke funnet" });
      }
      if (key && deleteImage) {
        try {
          await deleteImage(key);
        } catch (cleanupError) {
          console.error("[leadgrid] removed profile image cleanup failed", cleanupError);
        }
      }
      return res.json({ profile: shapeProfile(result.rows[0]) });
    } catch (error) {
      console.error("[leadgrid] profile image delete failed", error);
      return res.status(500).json({ error: "image_delete_failed" });
    }
  });
}
