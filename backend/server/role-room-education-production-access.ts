/**
 * role-room-education-production-access.ts — broen mellom utdannings-workspacet
 * og de EKTE produksjonsverktøyene (casting_projects).
 *
 * En studentproduksjon ER et casting_projects (via role_room_education_productions.
 * project_id). Faglærer tildeler studenter en produksjonsrolle (viewer/
 * contributor/lead) i role_room_education_production_members. Denne modulen lar
 * en students EKTE Role Room-konto (users, matchet på e-post) få tilgang til det
 * ekte prosjektet + riktig fane-RBAC — UTEN å skrive til casting_user_roles.
 *
 * 🔑 Bevisst IKKE casting_user_roles: den tabellen driver Stripe-sete-billing
 * (syncRoleRoomSeatQuantity). Studenter har egen TRR-lisens, ikke prod-seter, så
 * broen er en dual-check i tilgangs-/fane-laget i stedet — null billing-blast.
 * Faglærer-styrt og education-scopet (respekterer mig 0418-filosofien).
 */

import type { Pool } from "pg";

export type EduProductionRole = "viewer" | "contributor" | "lead";

/** De 18 produksjonsfanene (speiler STUDIO_TABS i studioAccessModel.ts). */
const TAB_KEYS = [
  "oversikt", "story-arc", "storyboard", "roles", "candidates", "auditions",
  "selection", "shotlist", "locations", "callsheet", "crew", "equipment",
  "live-set", "workspace", "economy", "timeline", "approval", "delivery",
] as const;

type TabMap = Record<string, "view" | "manage">;
const allTabs = (level: "view" | "manage"): TabMap =>
  Object.fromEntries(TAB_KEYS.map((k) => [k, level])) as TabMap;

/**
 * Education-rolle → fane-nivå-kart. Fane som mangler i kartet = skjult (matcher
 * resolver-semantikken i role-room-tab-access). Bevisst konservativt:
 *   viewer      – ser alt, redigerer ingenting.
 *   contributor – redigerer det kreative + prosjektrom/live-set; ser produksjon/
 *                 forretning; Økonomi skjult.
 *   lead        – redigerer det meste (regissør/produsent-lignende); ser Økonomi/
 *                 Godkjenning/Levering (klient-vendt), redigerer dem ikke.
 */
export const EDU_TAB_ACCESS: Record<EduProductionRole, TabMap> = {
  viewer: allTabs("view"),
  contributor: (() => {
    const m: TabMap = allTabs("view");
    for (const k of ["story-arc", "storyboard", "roles", "candidates", "auditions", "selection", "shotlist", "workspace", "live-set"]) m[k] = "manage";
    delete m.economy; // skjult
    return m;
  })(),
  lead: (() => {
    const m: TabMap = allTabs("manage");
    m.economy = "view";
    m.approval = "view";
    m.delivery = "view";
    return m;
  })(),
};

function isMissingTable(err: unknown): boolean {
  return (err as { code?: string })?.code === "42P01";
}

/**
 * Er den innloggede brukeren (ordinær users-konto) tildelt dette casting_projectet
 * VIA utdannings-workspacet? Returnerer education-produksjonsrollen, ellers null.
 * Matcher users.email → education-studentens e-post. Fail-closed (feil → null).
 */
export async function resolveEducationProductionRole(
  pool: Pool,
  userId: string,
  projectId: string,
): Promise<EduProductionRole | null> {
  if (!userId || !projectId) return null;
  try {
    const r = await pool.query(
      `SELECT m.role
         FROM role_room_education_productions p
         JOIN role_room_education_production_members m ON m.production_id = p.id
         JOIN role_room_education_students s ON s.id = m.student_id
         JOIN users u ON lower(u.email) = lower(s.email)
        WHERE p.project_id = $1 AND u.id = $2
        LIMIT 1`,
      [projectId, userId],
    );
    const role = r.rows[0]?.role as string | undefined;
    if (role === "viewer" || role === "contributor" || role === "lead") return role;
    if (role) return "viewer"; // ukjent rolle → mest restriktivt
    return null;
  } catch (err) {
    if (isMissingTable(err)) return null;
    console.error("[edu-production-access] resolve failed (fail-closed):", (err as Error).message);
    return null;
  }
}

/**
 * Alle casting_projects.id-er brukeren kan nå VIA utdannings-broen (på tvers av
 * alle produksjoner de er tildelt, uansett rolle). Brukes av /projects-listen
 * for å slå sammen bro-prosjekter med eide/medlemsprosjekter. Fail-closed ([]).
 */
export async function listEducationProductionProjectIds(
  pool: Pool,
  userId: string,
): Promise<string[]> {
  if (!userId) return [];
  try {
    const r = await pool.query(
      `SELECT DISTINCT p.project_id
         FROM role_room_education_productions p
         JOIN role_room_education_production_members m ON m.production_id = p.id
         JOIN role_room_education_students s ON s.id = m.student_id
         JOIN users u ON lower(u.email) = lower(s.email)
        WHERE u.id = $1`,
      [userId],
    );
    return r.rows.map((row) => row.project_id as string).filter(Boolean);
  } catch (err) {
    if (isMissingTable(err)) return [];
    console.error("[edu-production-access] list failed (fail-closed):", (err as Error).message);
    return [];
  }
}
