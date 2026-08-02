/**
 * marketing-catalog-service.ts
 *
 * Business DNA — Catalog: en produktkatalog kampanjene kan trekke fra.
 * Auto-populeres fra systemets vertikaler (speiler ALL_PROFESSION_MODES i
 * frontend/…/config/professionMode.ts + topp-produktene), og admin kan legge
 * til/fjerne. Tabellen self-heales lazily (Render har ingen preDeploy-migrasjon).
 */

import type { Pool } from "pg";

/** Systemets vertikaler/produkter — kilden katalogen auto-populeres fra.
 *  Speiler ALL_PROFESSION_MODES + topp-produktene (GEO-settene). */
const SYSTEM_VERTICALS: Array<{ key: string; name: string; description: string }> = [
  { key: "leadgrid", name: "Leadgrid", description: "Kartbasert felt-CRM for B2B-salg — finn, følg opp og vinn lokale kunder." },
  { key: "the_role_room", name: "The Role Room", description: "Operativsystem for film- og innholdsproduksjon: casting, selvtape, crew, call-sheets." },
  { key: "creatorhub", name: "CreatorHub", description: "Prosjektstyring, leveranse og fakturering for fotografer og videografer." },
  { key: "talents", name: "Talents", description: "Byrå- og talent-registry — marketplace for skuespillere og scenekunstnere." },
  { key: "reknaren", name: "Reknaren", description: "Norsk regnskaps-app — bilag, faktura, MVA og årsavslutning." },
  { key: "production", name: "Produksjon (film/video)", description: "Film- og videoproduksjon: manus, storyboard, crew og planlegging." },
  { key: "photographer", name: "Fotograf", description: "Foto-prosjekter: booking, leveranse, galleri og showcase." },
  { key: "content_producer", name: "Innholdsprodusent", description: "Innholdsproduksjon på tvers av kanaler." },
  { key: "content_creator", name: "Innholdsskaper", description: "Verktøy for innholdsskapere og creators." },
  { key: "dance_studio", name: "Dansestudio", description: "Studioeier: audition, ensemble, prøveplan og forestillinger." },
  { key: "dance_freelance", name: "Dans — frilanser", description: "Frilans danser: tilgjengelighet, portfolio og oppdrag." },
  { key: "education", name: "Utdanning", description: "Film-/medieutdanning: kull, studentproduksjoner, LMS (Feide/LTI) og faglærer-oversikt." },
];

export type CatalogSource = "system_vertical" | "custom" | "url_import";

export interface CatalogItem {
  id: string;
  itemKey: string | null;
  name: string;
  description: string | null;
  imageUrl: string | null;
  source: CatalogSource;
  active: boolean;
}

let tablesReady = false;
export async function ensureTables(pool: Pool): Promise<void> {
  if (tablesReady) return;
  await pool.query(`
    CREATE TABLE IF NOT EXISTS marketing_catalog_items (
      id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id      UUID NOT NULL,
      item_key     TEXT,
      name         VARCHAR(160) NOT NULL,
      description  TEXT,
      image_url    TEXT,
      source       VARCHAR(24) NOT NULL DEFAULT 'custom',
      active       BOOLEAN NOT NULL DEFAULT TRUE,
      created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE (user_id, item_key)
    );
    CREATE INDEX IF NOT EXISTS idx_marketing_catalog_items_user
      ON marketing_catalog_items (user_id);
  `);
  tablesReady = true;
}

interface CatalogRow {
  id: string;
  item_key: string | null;
  name: string;
  description: string | null;
  image_url: string | null;
  source: string;
  active: boolean;
}

function rowToItem(r: CatalogRow): CatalogItem {
  const source: CatalogSource =
    r.source === "system_vertical" || r.source === "url_import" ? r.source : "custom";
  return {
    id: r.id,
    itemKey: r.item_key,
    name: r.name,
    description: r.description,
    imageUrl: r.image_url,
    source,
    active: r.active,
  };
}

/** Idempotent: legg inn systemets vertikaler som ikke allerede finnes for brukeren. */
async function seedSystemVerticals(pool: Pool, userId: string): Promise<void> {
  for (const v of SYSTEM_VERTICALS) {
    await pool.query(
      `INSERT INTO marketing_catalog_items (user_id, item_key, name, description, source)
       VALUES ($1, $2, $3, $4, 'system_vertical')
       ON CONFLICT (user_id, item_key) DO NOTHING`,
      [userId, v.key, v.name, v.description],
    );
  }
}

/** Auto-populerer fra vertikalene ved første kall, og returnerer hele katalogen. */
export async function listCatalog(pool: Pool, userId: string): Promise<CatalogItem[]> {
  await ensureTables(pool);
  await seedSystemVerticals(pool, userId);
  const r = await pool.query<CatalogRow>(
    `SELECT id, item_key, name, description, image_url, source, active
       FROM marketing_catalog_items
      WHERE user_id = $1
      ORDER BY (source = 'system_vertical') DESC, name ASC`,
    [userId],
  );
  return r.rows.map(rowToItem);
}

export async function createItem(
  pool: Pool,
  userId: string,
  input: { name: string; description?: string; imageUrl?: string; source?: CatalogSource },
): Promise<CatalogItem> {
  await ensureTables(pool);
  const source: CatalogSource = input.source === "url_import" ? "url_import" : "custom";
  const r = await pool.query<CatalogRow>(
    `INSERT INTO marketing_catalog_items (user_id, name, description, image_url, source)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING id, item_key, name, description, image_url, source, active`,
    [userId, input.name.slice(0, 160), input.description ?? null, input.imageUrl ?? null, source],
  );
  return rowToItem(r.rows[0]);
}

export async function updateItem(
  pool: Pool,
  userId: string,
  id: string,
  patch: { name?: string; description?: string | null; imageUrl?: string | null; active?: boolean },
): Promise<CatalogItem | null> {
  await ensureTables(pool);
  const sets: string[] = [];
  const params: unknown[] = [id, userId];
  const add = (col: string, val: unknown): void => {
    params.push(val);
    sets.push(`${col} = $${params.length}`);
  };
  if (typeof patch.name === "string") add("name", patch.name.slice(0, 160));
  if (patch.description !== undefined) add("description", patch.description);
  if (patch.imageUrl !== undefined) add("image_url", patch.imageUrl);
  if (typeof patch.active === "boolean") add("active", patch.active);
  if (sets.length === 0) return null;
  const r = await pool.query<CatalogRow>(
    `UPDATE marketing_catalog_items SET ${sets.join(", ")}, updated_at = NOW()
      WHERE id = $1 AND user_id = $2
      RETURNING id, item_key, name, description, image_url, source, active`,
    params,
  );
  return r.rows[0] ? rowToItem(r.rows[0]) : null;
}

export async function deleteItem(pool: Pool, userId: string, id: string): Promise<boolean> {
  await ensureTables(pool);
  const r = await pool.query(
    `DELETE FROM marketing_catalog_items WHERE id = $1 AND user_id = $2`,
    [id, userId],
  );
  return (r.rowCount ?? 0) > 0;
}
