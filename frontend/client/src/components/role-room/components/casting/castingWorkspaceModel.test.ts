import { describe, expect, it } from 'vitest';
import { buildCastingWorkspaceBrief } from './castingWorkspaceModel';

describe('buildCastingWorkspaceBrief', () => {
  it('derives casting status only from registered project data', () => {
    const brief = buildCastingWorkspaceBrief({
      roles: [
        { id: 'role-1', name: 'Nora', status: 'casting' },
        { id: 'role-2', name: 'Jon', status: 'filled' },
      ],
      candidates: [
        { id: 'candidate-1', name: 'Ada', status: 'shortlist' },
        { id: 'candidate-2', name: 'Ola', status: 'confirmed' },
      ],
      schedules: [
        { id: 'schedule-1', date: '2026-09-20', status: 'scheduled' },
        { id: 'schedule-2', date: '2026-09-18', status: 'completed' },
        { id: 'schedule-3', date: '2026-09-21', status: 'cancelled' },
      ],
      today: '2026-09-19',
    });

    expect(brief.stats).toEqual({
      roleCount: 2,
      openRoleCount: 1,
      candidateCount: 2,
      shortlistCount: 1,
      selectedCount: 1,
      scheduledAuditionCount: 1,
    });
    expect(brief.actions.map((action) => action.target)).toEqual([
      'roles', 'talents', 'candidates', 'auditions', 'selection',
    ]);
  });

  it('shows honest empty states without inventing readiness', () => {
    const brief = buildCastingWorkspaceBrief({ roles: [], candidates: [], schedules: [], today: '2026-09-19' });

    expect(brief.actions[0]).toMatchObject({ tone: 'attention', evidence: '0 registrerte roller' });
    expect(brief.actions[3].title).toBe('Ingen kommende auditions registrert');
    expect(brief.stats.selectedCount).toBe(0);
  });

  it('derives unstated role readiness from confirmed role assignments instead of guessing closed', () => {
    const brief = buildCastingWorkspaceBrief({
      roles: [
        { id: 'role-nora', name: 'NORA' },
        { id: 'role-jon', name: 'JON' },
      ],
      candidates: [
        { id: 'candidate-1', name: 'Ada', status: 'confirmed', roleId: 'role-nora' },
      ],
      schedules: [],
      today: '2026-09-19',
    });

    expect(brief.stats.openRoleCount).toBe(1);
    expect(brief.stats.selectedCount).toBe(1);
  });
});
