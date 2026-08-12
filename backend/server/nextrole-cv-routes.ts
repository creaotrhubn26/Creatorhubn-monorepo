/**
 * nextrole-cv-routes.ts
 *
 * Bygger en CV fra The Role Room-onboarding-profilen + casting-prosjekter.
 * Dette er datakilden for «Bygg CV fra profilen» i NextRole ResumeBuilder:
 * CV-en leses DIREKTE fra onboarding-dataene (ingen duplisert lagring), og
 * prosjekter brukeren jobber på synkes automatisk inn med rolle + status.
 *
 *   GET /api/nextrole/cv/me
 *     → { source: 'role-room', cv: {...} | null, projectStats: {...} }
 *
 * Komponerer fra:
 *   - role_room_member_profiles (navn, tittel, bio, ferdigheter, språk,
 *     sertifiseringer, referanser, tidligere prosjekter, utstyr, ...)
 *   - casting_projects JOIN casting_user_roles (prosjekter brukeren har rolle i)
 *
 * Defensivt: hvis casting-tabellene ikke finnes (schema-drift), returneres
 * CV-en uten auto-prosjekter i stedet for 500.
 */

import type express from "express";
import type { Pool } from "pg";
import { presignRoleRoomB2Download } from "./b2-archive-helper.js";

export interface NextRoleCvRoutesDeps {
  app: express.Application;
  pool: Pool;
  getActiveSessionFromRequest: (req: express.Request) => {
    userId: string;
    email: string;
    name: string;
    role: string;
  } | null;
}

// Språk-koder → visningsnavn (samme katalog som onboarding).
const LANGUAGE_NAMES: Record<string, string> = {
  no: "Norsk", nb: "Norsk", nn: "Norsk", sv: "Svenska", da: "Dansk", en: "English",
  de: "Tysk", fr: "Fransk", es: "Spansk", it: "Italiensk", pt: "Portugisisk",
  pl: "Polsk", fi: "Finsk", is: "Islandsk", nl: "Nederlandsk", tr: "Tyrkisk",
  ru: "Russisk", uk: "Ukrainsk", ar: "Arabisk", ur: "Urdu", th: "Thai",
  vi: "Vietnamesisk", ro: "Rumensk", lt: "Litauisk", et: "Estisk",
  zh: "Kinesisk", ja: "Japansk", ko: "Koreansk",
};

// Statuser som teller som «gjennomført/godkjent» i CV-statistikken.
const COMPLETED_STATUSES = new Set([
  "completed", "done", "archived", "delivered", "approved",
  "ferdig", "levert", "fullfort", "godkjent",
]);

const PROFILE_IMAGE_TTL_SECONDS = 7 * 24 * 60 * 60;

export function setupNextRoleCvRoutes(deps: NextRoleCvRoutesDeps): void {
  const { app, pool, getActiveSessionFromRequest } = deps;

  app.get("/api/nextrole/cv/me", async (req, res) => {
    const session = getActiveSessionFromRequest(req);
    if (!session) {
      res.status(401).json({ error: "auth_required" });
      return;
    }
    const userId = session.userId;

    try {
      // 1) Onboarding-profil
      const { rows } = await pool.query(
        `SELECT p.*, u.email
           FROM role_room_member_profiles p
           JOIN users u ON u.id = p.user_id
          WHERE p.user_id = $1`,
        [userId],
      );
      const row = rows[0];
      if (!row) {
        // Ingen onboarding-profil ennå — CV kan ikke bygges.
        res.json({ source: "role-room", cv: null, projectStats: { total: 0, completed: 0 } });
        return;
      }

      // Profilbilde (presign hvis B2-nøkkel)
      let profilePhoto: string | null = row.profile_image_url ?? null;
      if (row.profile_image_b2_key) {
        const signed = await presignRoleRoomB2Download(
          row.profile_image_b2_key, undefined, PROFILE_IMAGE_TTL_SECONDS,
        );
        if (signed) profilePhoto = signed;
      }

      const professions: string[] = Array.isArray(row.professions) ? row.professions : [];
      const skillsRaw: string[] = Array.isArray(row.skills) ? row.skills : [];
      const equipmentRaw: string[] = Array.isArray(row.equipment) ? row.equipment : [];
      const expertiseAreasRaw: string[] = Array.isArray(row.expertise_areas) ? row.expertise_areas : [];
      const certificationsRaw: string[] = Array.isArray(row.certifications) ? row.certifications : [];
      const languagesRaw: string[] = Array.isArray(row.languages) ? row.languages : [];
      const earlierProjectsRaw: unknown[] = Array.isArray(row.earlier_projects) ? row.earlier_projects : [];
      const portfolioItemsRaw: unknown[] = Array.isArray(row.portfolio_items) ? row.portfolio_items : [];
      const memberReferencesRaw: unknown[] = Array.isArray(row.member_references) ? row.member_references : [];
      const socialLinks = row.social_links && typeof row.social_links === "object"
        ? (row.social_links as Record<string, unknown>)
        : {};

      // 2) Auto-prosjekter (casting_projects JOIN casting_user_roles)
      let castingProjects: Array<Record<string, unknown>> = [];
      try {
        const pr = await pool.query(
          `SELECT cp.id, cp.name, cp.status, cp.project_type, cp.start_date,
                  cp.end_date, cp.metadata, cp.created_at, cur.role
             FROM casting_projects cp
             JOIN casting_user_roles cur ON cur.project_id = cp.id
            WHERE cur.user_id = $1
            ORDER BY COALESCE(cp.start_date, cp.created_at::date) DESC NULLS LAST`,
          [userId],
        );
        castingProjects = pr.rows;
      } catch (err) {
        // Schema-drift skal ikke krasje CV-en — returner uten auto-prosjekter.
        console.warn(
          "[nextrole-cv] casting-prosjekter feilet, returnerer uten prosjekter:",
          (err as Error).message || err,
        );
      }

      // 3) Komponer CV-DTO
      const location = [row.location_city, row.location_country].filter(Boolean).join(", ") || null;

      const skills = buildSkills(skillsRaw, equipmentRaw, expertiseAreasRaw);

      const languages = (languagesRaw as string[])
        .map((code) => {
          const c = String(code || "").toLowerCase();
          const isNative = c === "no" || c === "nb" || c === "nn";
          return {
            code: c,
            name: LANGUAGE_NAMES[c] ?? c,
            isNative,
            proficiencyLevel: isNative ? 100 : 80,
          };
        })
        .filter((l) => l.code);

      const certifications = certificationsRaw
        .map((c) => String(c || "").trim())
        .filter(Boolean)
        .map((name) => ({ name }));

      const earlierProjects = earlierProjectsRaw.map(normalizeEarlierProject);
      const portfolioProjects = portfolioItemsRaw.map((item, idx) => {
        const it = item && typeof item === "object" ? (item as Record<string, unknown>) : {};
        return {
          title: String(it.title ?? it.name ?? `Arbeidsprøve ${idx + 1}`),
          role: typeof it.role === "string" ? it.role : undefined,
          projectUrl: typeof it.url === "string" ? it.url : (typeof it.link === "string" ? it.link : undefined),
          description: typeof it.description === "string" ? it.description : undefined,
          autoGenerated: false,
        };
      });

      // Casting-prosjekter (auto-synket, dedup på project_id)
      const seen = new Set<string>();
      const autoProjects = castingProjects
        .filter((p) => {
          const pid = String(p.id || "");
          if (!pid || seen.has(pid)) return false;
          seen.add(pid);
          return true;
        })
        .map((p) => ({
          title: String(p.name ?? "Prosjekt"),
          role: typeof p.role === "string" ? p.role : undefined,
          projectId: String(p.id),
          status: typeof p.status === "string" ? p.status : null,
          projectType: typeof p.project_type === "string" ? p.project_type : null,
          startDate: toDateString(p.start_date),
          description: extractMetadataDescription(p.metadata),
          autoGenerated: true,
        }));

      const completed = castingProjects.filter((p) =>
        COMPLETED_STATUSES.has(String(p.status || "").toLowerCase()),
      ).length;

      const cv = {
        personalInfo: {
          fullName: row.display_name ?? "",
          email: row.email ?? "",
          phone: null,
          location,
          website: typeof row.website === "string" ? row.website : null,
          linkedin: typeof socialLinks.linkedin === "string" ? socialLinks.linkedin : null,
          github: null,
          portfolio: typeof row.website === "string" ? row.website : null,
          profilePhoto,
          professionalTitle: professions[0] ?? null,
          summary: typeof row.bio === "string" ? row.bio : null,
        },
        company: typeof row.company_name === "string" ? row.company_name : null,
        professions,
        skills,
        languages,
        certifications,
        projects: [...earlierProjects, ...portfolioProjects, ...autoProjects],
        memberReferences: memberReferencesRaw.map(normalizeReference).filter(Boolean),
      };

      res.json({
        source: "role-room",
        cv,
        projectStats: { total: autoProjects.length, completed },
      });
    } catch (err) {
      console.error("[nextrole-cv] GET /api/nextrole/cv/me feilet:", err);
      res.status(500).json({ error: "intern_feil" });
    }
  });
}

// ── Hjelpefunksjoner ─────────────────────────────────────────────

function buildSkills(
  skills: string[],
  equipment: string[],
  areas: string[],
): Array<{ name: string; category?: string; proficiencyLevel: number }> {
  const out: Array<{ name: string; category?: string; proficiencyLevel: number }> = [];
  const seen = new Set<string>();
  const push = (name: string, category: string | undefined, level: number) => {
    const n = String(name || "").trim();
    if (!n || seen.has(n.toLowerCase())) return;
    seen.add(n.toLowerCase());
    out.push({ name: n, category, proficiencyLevel: level });
  };
  skills.forEach((s) => push(s, undefined, 80));
  equipment.forEach((e) => push(e, "Utstyr", 70));
  areas.forEach((a) => push(a, "Fagområde", 70));
  return out;
}

function normalizeEarlierProject(item: unknown): Record<string, unknown> {
  const it = item && typeof item === "object" ? (item as Record<string, unknown>) : {};
  const name = typeof it.name === "string" ? it.name : (typeof it.title === "string" ? it.title : "");
  return {
    title: name,
    role: typeof it.role === "string" ? it.role : undefined,
    description: typeof it.description === "string" ? it.description : undefined,
    startDate: toDateString(it.startDate ?? it.start_date),
    endDate: toDateString(it.endDate ?? it.end_date),
    projectUrl: typeof it.url === "string" ? it.url : (typeof it.link === "string" ? it.link : undefined),
    autoGenerated: false,
  };
}

function normalizeReference(item: unknown): Record<string, unknown> | null {
  const it = item && typeof item === "object" ? (item as Record<string, unknown>) : {};
  const name = typeof it.name === "string" ? it.name : "";
  if (!name) return null;
  return {
    name,
    role: typeof it.role === "string" ? it.role : undefined,
    contact: typeof it.contact === "string" ? it.contact : (typeof it.email === "string" ? it.email : undefined),
    note: typeof it.note === "string" ? it.note : undefined,
  };
}

function extractMetadataDescription(metadata: unknown): string | null {
  if (!metadata || typeof metadata !== "object") return null;
  const m = metadata as Record<string, unknown>;
  if (typeof m.description === "string" && m.description) return m.description;
  return null;
}

function toDateString(value: unknown): string | undefined {
  if (!value) return undefined;
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  if (typeof value === "string") return value.slice(0, 10);
  return undefined;
}
