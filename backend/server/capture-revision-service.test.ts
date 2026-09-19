import { describe, expect, it, vi } from 'vitest';
import {
  createCaptureRevision,
  listCaptureRevisions,
  updateCaptureRevisionStatus,
} from './capture-revision-service.js';

describe('Capture revision authorization', () => {
  it('binds project owner and optional asset ownership into the insert', async () => {
    const query = vi.fn().mockResolvedValue({ rows: [{ id: 'revision-1' }] });
    const id = await createCaptureRevision({ query } as any, {
      projectId: 'project-1',
      ownerUserId: 'owner-1',
      assetId: '00000000-0000-4000-8000-000000000001',
      originalFilename: 'IMG_0001.CR3',
      clientEmail: 'client@example.com',
      note: 'Litt lysere',
      source: 'gallery',
    });

    expect(id).toBe('revision-1');
    expect(query).toHaveBeenCalledOnce();
    const [sql, values] = query.mock.calls[0]!;
    expect(sql).toContain('p.user_id = $2');
    expect(sql).toContain('s.owner_user_id = $2');
    expect(sql).toContain('s.project_id = $1');
    expect(values).toEqual([
      'project-1', 'owner-1', '00000000-0000-4000-8000-000000000001',
      'IMG_0001.CR3', 'client@example.com', 'Litt lysere', 'gallery',
    ]);
  });

  it('returns null when the insert ownership predicates reject the request', async () => {
    const query = vi.fn().mockResolvedValue({ rows: [] });
    const id = await createCaptureRevision({ query } as any, {
      projectId: 'someone-elses-project', ownerUserId: 'attacker', assetId: null,
      originalFilename: 'IMG.CR3', clientEmail: null, note: '', source: 'gallery',
    });
    expect(id).toBeNull();
  });

  it('does not list revisions before confirming project ownership', async () => {
    const query = vi.fn().mockResolvedValueOnce({ rows: [] });
    const rows = await listCaptureRevisions(
      { query } as any, 'attacker', 'someone-elses-project', 'open',
    );
    expect(rows).toBeNull();
    expect(query).toHaveBeenCalledOnce();
  });

  it('updates status only through an owner-scoped project join', async () => {
    const query = vi.fn().mockResolvedValue({ rows: [] });
    const updated = await updateCaptureRevisionStatus(
      { query } as any,
      'attacker',
      '00000000-0000-4000-8000-000000000002',
      'resolved',
    );
    expect(updated).toBe(false);
    const [sql, values] = query.mock.calls[0]!;
    expect(sql).toContain('project.user_id = $3');
    expect(values).toEqual([
      '00000000-0000-4000-8000-000000000002', 'resolved', 'attacker',
    ]);
  });
});
