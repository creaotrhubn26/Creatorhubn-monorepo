import { describe, expect, it, vi } from 'vitest';
import type { Pool } from 'pg';

import { AI_FRAME_DAILY_LIMIT, AiFrameError, createAiReferenceFrame, decodeImageBase64 } from './role-room-narrative-frames-ai.js';

const PNG = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(200, 1)]).toString('base64');

type Handler = { match: RegExp; rows: Record<string, unknown>[] | ((params: unknown[]) => Record<string, unknown>[]) };
function makePool(handlers: Handler[] = []) {
  const query = vi.fn(async (sql: string, params: unknown[] = []) => {
    for (const h of handlers) if (h.match.test(sql)) { const rows = typeof h.rows === 'function' ? h.rows(params) : h.rows; return { rows, rowCount: rows.length }; }
    return { rows: [], rowCount: 0 };
  });
  return { query } as unknown as Pool & { query: typeof query };
}
const sceneRows: Handler[] = [
  { match: /SELECT id FROM narrative_assets WHERE id = \$1 AND project_id = \$2/, rows: (p) => [{ id: p[0] }] },
  { match: /FROM narrative_scenes WHERE/, rows: [{ id: 'nsc_1', project_id: 'proj', code: 'P01', title: 'Skoleveien', status: 'idea', sort_order: 0, created_at: new Date(), updated_at: new Date(), source_refs: [], knowledge: {} }] },
  { match: /INSERT INTO narrative_scene_frames/, rows: (p) => [{ id: p[0], scene_id: 'nsc_1', project_id: 'proj', asset_id: p[3], external_url: null, caption: p[5] ?? p[4], sort_order: 0, created_at: new Date(), updated_at: new Date() }] },
];

describe('decodeImageBase64', () => {
  it('godtar PNG (rå og data-URL), avviser annet', () => {
    expect(decodeImageBase64(PNG).mime).toBe('image/png');
    expect(decodeImageBase64(`data:image/png;base64,${PNG}`).ext).toBe('png');
    expect(() => decodeImageBase64(Buffer.alloc(200, 7).toString('base64'))).toThrow(AiFrameError);
    expect(() => decodeImageBase64('not base64!!')).toThrow(AiFrameError);
  });
});

describe('createAiReferenceFrame', () => {
  it('lagrer PNG i objektlager, oppretter image-asset med storage_key og en ramme «KI-referanse»', async () => {
    const pool = makePool([{ match: /COUNT\(\*\)::int AS n FROM narrative_assets/, rows: [{ n: 2 }] }, ...sceneRows]);
    const put = vi.fn(async () => true);
    const r = await createAiReferenceFrame(pool, 'proj', 'nsc_1', 'u1', { imageBase64: PNG, caption: 'Skoleveien, lykt', model: 'dall-e-3' }, { put });
    expect(put).toHaveBeenCalledWith(expect.stringMatching(/^narrative\/proj\/frames\/nsc_1\/.+\.png$/), expect.any(Buffer), 'image/png', expect.objectContaining({ sceneId: 'nsc_1' }));
    const ins = pool.query.mock.calls.find(([q]) => /INSERT INTO narrative_assets/.test(String(q)))!;
    expect(ins[1][3]).toBe(r.storageKey);
    expect(ins[1][4]).toBe('image/png');
    expect(ins[1][6]).toBe('ki-referanse');
    expect(r.usedToday).toBe(3);
    expect(r.dailyLimit).toBe(AI_FRAME_DAILY_LIMIT);
  });

  it('daglig tak → daily_limit uten lagring; manglende objektlager → storage_unavailable', async () => {
    const full = makePool([{ match: /COUNT\(\*\)::int AS n FROM narrative_assets/, rows: [{ n: AI_FRAME_DAILY_LIMIT }] }, ...sceneRows]);
    const put = vi.fn(async () => true);
    await expect(createAiReferenceFrame(full, 'proj', 'nsc_1', 'u1', { imageBase64: PNG }, { put })).rejects.toMatchObject({ code: 'daily_limit' });
    expect(put).not.toHaveBeenCalled();
    const pool = makePool([{ match: /COUNT\(\*\)::int AS n FROM narrative_assets/, rows: [{ n: 0 }] }, ...sceneRows]);
    await expect(createAiReferenceFrame(pool, 'proj', 'nsc_1', 'u1', { imageBase64: PNG }, { put: vi.fn(async () => false) })).rejects.toMatchObject({ code: 'storage_unavailable' });
    expect(pool.query.mock.calls.some(([q]) => /INSERT INTO narrative_assets/.test(String(q)))).toBe(false);
  });
});
