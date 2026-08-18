import type { Pool } from 'pg';

export const SIMILARITY_THRESHOLD = 0.92;

export interface TacticFinding {
  tactic: string;
  evidence: string;
  targetElementLabel?: string;
  hotspot?: { x: number; y: number; w: number; h: number };
  exampleBrand: string;
  exampleDescription: string;
}

function vectorToPg(vector: number[]): string {
  return `[${vector.join(',')}]`;
}

export async function findCachedTactics(
  pool: Pool,
  params: { embedding: number[] },
): Promise<{ domain: string; findings: TacticFinding[]; similarity: number } | null> {
  const { rows } = await pool.query<{ domain: string; raw_findings: TacticFinding[]; similarity: number }>(
    `SELECT domain, raw_findings,
            1 - (embedding <=> $1::vector) AS similarity
     FROM marketing_tactic_findings
     WHERE embedding IS NOT NULL
     ORDER BY embedding <=> $1::vector
     LIMIT 1`,
    [vectorToPg(params.embedding)],
  );
  const top = rows[0];
  if (!top || top.similarity < SIMILARITY_THRESHOLD) return null;
  return { domain: top.domain, findings: top.raw_findings, similarity: top.similarity };
}

export async function storeTacticFindings(
  pool: Pool,
  params: { domain: string; pageText: string; embedding: number[] | null; findings: TacticFinding[] },
): Promise<string> {
  const { rows } = await pool.query<{ id: string }>(
    `INSERT INTO marketing_tactic_findings (domain, page_text_snapshot, raw_findings, embedding)
     VALUES ($1, $2, $3::jsonb, $4::vector)
     RETURNING id`,
    [params.domain, params.pageText.slice(0, 8000), JSON.stringify(params.findings), params.embedding ? vectorToPg(params.embedding) : null],
  );
  return rows[0].id;
}

export async function recordTacticFeedback(
  pool: Pool,
  params: { id: string; feedback: Record<string, 'accepted' | 'rejected' | 'edited'> },
): Promise<void> {
  await pool.query(
    `UPDATE marketing_tactic_findings SET user_feedback = $2::jsonb WHERE id = $1`,
    [params.id, JSON.stringify(params.feedback)],
  );
}
