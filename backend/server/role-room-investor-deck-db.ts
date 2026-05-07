/**
 * role-room-investor-deck-db.ts
 *
 * Persistence helpers for `decks` + `deck_slides` (Migration 130).
 * Pure DB layer; routes layer handles auth + Claude calls.
 */

import type { Pool } from "pg";
import { initialInvestorDeckSlides, type InvestorSection } from "./role-room-investor-deck-template.js";

export interface DeckRow {
  id: string;
  userId: string;
  projectId: string | null;
  businessProfileId: string | null;
  templateId: string;
  title: string;
  description: string | null;
  status: "draft" | "published" | "archived";
  theme: Record<string, unknown>;
  slideCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface DeckSlideRow {
  id: string;
  deckId: string;
  position: number;
  section: InvestorSection;
  layout: string;
  content: { heading?: string; body?: string; [k: string]: unknown };
  notes: string | null;
  thumbnailKey: string | null;
  createdAt: string;
  updatedAt: string;
}

function rowToDeck(row: Record<string, unknown>): DeckRow {
  return {
    id: row.id as string,
    userId: row.user_id as string,
    projectId: (row.project_id as string | null) ?? null,
    businessProfileId: (row.business_profile_id as string | null) ?? null,
    templateId: row.template_id as string,
    title: row.title as string,
    description: (row.description as string | null) ?? null,
    status: row.status as DeckRow["status"],
    theme: (row.theme as Record<string, unknown>) ?? {},
    slideCount: Number(row.slide_count ?? 0),
    createdAt: new Date(row.created_at as string).toISOString(),
    updatedAt: new Date(row.updated_at as string).toISOString(),
  };
}

function rowToSlide(row: Record<string, unknown>): DeckSlideRow {
  return {
    id: row.id as string,
    deckId: row.deck_id as string,
    position: Number(row.position),
    section: row.section as InvestorSection,
    layout: row.layout as string,
    content: (row.content as DeckSlideRow["content"]) ?? {},
    notes: (row.notes as string | null) ?? null,
    thumbnailKey: (row.thumbnail_key as string | null) ?? null,
    createdAt: new Date(row.created_at as string).toISOString(),
    updatedAt: new Date(row.updated_at as string).toISOString(),
  };
}

export interface CreateInvestorDeckInput {
  userId: string;
  projectId?: string | null;
  businessProfileId?: string | null;
  title: string;
  description?: string | null;
}

/** Creates a deck + seeds the 10 investor-pitch-v1 slides in a single transaction. */
export async function createInvestorDeck(
  pool: Pool,
  input: CreateInvestorDeckInput,
): Promise<{ deck: DeckRow; slides: DeckSlideRow[] }> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const deckResult = await client.query(
      `INSERT INTO decks (user_id, project_id, business_profile_id, template_id, title, description, slide_count)
       VALUES ($1,$2,$3,'investor-pitch-v1',$4,$5,$6)
       RETURNING *`,
      [
        input.userId,
        input.projectId ?? null,
        input.businessProfileId ?? null,
        input.title,
        input.description ?? null,
        initialInvestorDeckSlides().length,
      ],
    );
    const deck = rowToDeck(deckResult.rows[0]);

    const slides: DeckSlideRow[] = [];
    for (const seed of initialInvestorDeckSlides()) {
      const slideResult = await client.query(
        `INSERT INTO deck_slides (deck_id, position, section, layout, content)
         VALUES ($1,$2,$3,$4,$5)
         RETURNING *`,
        [deck.id, seed.position, seed.section, seed.layout, JSON.stringify(seed.content)],
      );
      slides.push(rowToSlide(slideResult.rows[0]));
    }

    await client.query("COMMIT");
    return { deck, slides };
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}

export async function getDeckById(
  pool: Pool,
  deckId: string,
  userId: string,
): Promise<DeckRow | null> {
  const result = await pool.query(
    `SELECT * FROM decks WHERE id = $1 AND user_id = $2`,
    [deckId, userId],
  );
  if (!result.rowCount) return null;
  return rowToDeck(result.rows[0]);
}

export async function listDecksForUser(
  pool: Pool,
  userId: string,
  options?: { projectId?: string },
): Promise<DeckRow[]> {
  const params: unknown[] = [userId];
  let where = "user_id = $1";
  if (options?.projectId) {
    params.push(options.projectId);
    where += ` AND project_id = $${params.length}`;
  }
  const result = await pool.query(
    `SELECT * FROM decks WHERE ${where} ORDER BY updated_at DESC LIMIT 100`,
    params,
  );
  return result.rows.map(rowToDeck);
}

export async function listSlidesForDeck(
  pool: Pool,
  deckId: string,
): Promise<DeckSlideRow[]> {
  const result = await pool.query(
    `SELECT * FROM deck_slides WHERE deck_id = $1 ORDER BY position ASC`,
    [deckId],
  );
  return result.rows.map(rowToSlide);
}

export async function updateSlideContent(
  pool: Pool,
  slideId: string,
  content: Record<string, unknown>,
  notes?: string | null,
): Promise<DeckSlideRow | null> {
  const result = await pool.query(
    `UPDATE deck_slides
        SET content = $2, notes = COALESCE($3, notes), updated_at = now()
      WHERE id = $1 RETURNING *`,
    [slideId, JSON.stringify(content), notes ?? null],
  );
  if (!result.rowCount) return null;
  return rowToSlide(result.rows[0]);
}

export async function updateDeckMeta(
  pool: Pool,
  deckId: string,
  userId: string,
  patch: { title?: string; description?: string | null; status?: DeckRow["status"]; theme?: Record<string, unknown> },
): Promise<DeckRow | null> {
  const fields: string[] = [];
  const params: unknown[] = [deckId, userId];
  if (patch.title !== undefined) {
    params.push(patch.title);
    fields.push(`title = $${params.length}`);
  }
  if (patch.description !== undefined) {
    params.push(patch.description);
    fields.push(`description = $${params.length}`);
  }
  if (patch.status !== undefined) {
    params.push(patch.status);
    fields.push(`status = $${params.length}`);
  }
  if (patch.theme !== undefined) {
    params.push(JSON.stringify(patch.theme));
    fields.push(`theme = $${params.length}::jsonb`);
  }
  if (!fields.length) {
    return getDeckById(pool, deckId, userId);
  }
  fields.push("updated_at = now()");

  const result = await pool.query(
    `UPDATE decks SET ${fields.join(", ")} WHERE id = $1 AND user_id = $2 RETURNING *`,
    params,
  );
  if (!result.rowCount) return null;
  return rowToDeck(result.rows[0]);
}

export async function deleteDeck(
  pool: Pool,
  deckId: string,
  userId: string,
): Promise<boolean> {
  const result = await pool.query(
    `DELETE FROM decks WHERE id = $1 AND user_id = $2`,
    [deckId, userId],
  );
  return (result.rowCount ?? 0) > 0;
}
