/**
 * lead-map-me-profile-routes.ts
 *
 * Selger redigerer sin egen profil fra iPad:
 *   GET   /api/admin-room/lead-map/me/profile       → hent egne 4 felter
 *   PATCH /api/admin-room/lead-map/me/profile       → oppdater valgte felter
 *
 * 4 påkrevde felter (per memory project_lead_map_org_rbac_profiles):
 *   - profile_image_url (avatar)
 *   - phone (telefon)
 *   - profession (tittel/rolle-tekst som vises på selger-pin)
 *   - email (brukes som primær kontakt)
 *
 * Felter lagres i users-tabellen. Profile-completion sjekkes ved henting
 * så iPad kan vise om alle 4 er fyllt — gating før selger får selger-pin
 * synlig for andre.
 */

import type { Express, Request, Response } from "express";
import type { Pool } from "pg";

type SessionData = { userId: string; role?: string; email?: string };
interface Deps { app: Express; pool: Pool; activeSessions: Map<string, SessionData>; }

function getSession(req: Request, sessions: Map<string, SessionData>): SessionData | null {
  const auth = req.headers.authorization;
  if (auth?.startsWith("Bearer ")) return sessions.get(auth.substring(7)) ?? null;
  const t = (req as any).cookies?.sessionToken;
  return t ? sessions.get(t) ?? null : null;
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

function shapeProfile(r: ProfileRow) {
  const required = [
    !!r.profile_image_url,
    !!r.email,
    !!r.phone,
    !!r.profession,
  ];
  const completedCount = required.filter(Boolean).length;
  return {
    user_id: r.user_id,
    first_name: r.first_name,
    last_name: r.last_name,
    email: r.email,
    phone: r.phone,
    profession: r.profession,
    profile_image_url: r.profile_image_url,
    profile_complete: completedCount === 4,
    profile_completed_count: completedCount,
    profile_total_required: 4,
  };
}

export function registerLeadMapMeProfileRoutes({ app, pool, activeSessions }: Deps): void {

  app.get("/api/admin-room/lead-map/me/profile", async (req, res) => {
    const s = getSession(req, activeSessions);
    if (!s) return res.status(401).json({ error: "Ikke innlogget" });

    const r = await pool.query<ProfileRow>(
      `SELECT id AS user_id, first_name, last_name, email, phone,
              profession, profile_image_url
         FROM users WHERE id = $1`,
      [s.userId],
    );
    if (r.rows.length === 0) return res.status(404).json({ error: "Bruker ikke funnet" });
    res.json({ profile: shapeProfile(r.rows[0]) });
  });

  app.patch("/api/admin-room/lead-map/me/profile", async (req, res) => {
    const s = getSession(req, activeSessions);
    if (!s) return res.status(401).json({ error: "Ikke innlogget" });

    const b = req.body ?? {};
    const sets: string[] = [];
    const params: any[] = [];
    let n = 1;

    const allowed = ["first_name", "last_name", "email", "phone",
                      "profession", "profile_image_url"];
    for (const f of allowed) {
      if (f in b) {
        const v = b[f];
        if (typeof v === "string" || v === null) {
          sets.push(`${f} = $${n++}`);
          params.push(typeof v === "string" ? v.trim() : null);
        }
      }
    }
    if (sets.length === 0) {
      return res.status(400).json({ error: "Ingen felter å oppdatere" });
    }
    sets.push(`updated_at = now()`);
    params.push(s.userId);

    try {
      const r = await pool.query<ProfileRow>(
        `UPDATE users SET ${sets.join(", ")}
          WHERE id = $${params.length}
          RETURNING id AS user_id, first_name, last_name, email, phone,
                    profession, profile_image_url`,
        params,
      );
      res.json({ profile: shapeProfile(r.rows[0]) });
    } catch (e: any) {
      res.status(500).json({ error: e?.message ?? "Oppdatering feilet" });
    }
  });
}
