import { describe, expect, it } from 'vitest';
import {
  sanitiseCoverage,
  sanitiseReplan,
  sanitiseContinuity,
  sanitiseEndOfDay,
  type ReplanDayInput,
  type ContinuityCheckInput,
  type EndOfDayInput,
} from './live-set-ai-routes.js';

describe('sanitiseCoverage', () => {
  it('clamps unknown severity to recommended and unknown status to gaps', () => {
    const out = sanitiseCoverage({
      status: 'MAYBE',
      missingCoverage: [
        { type: 'master', reason: 'x', severity: 'SHRUG' },
        { type: 'close-up', reason: 'y', severity: 'critical' },
      ],
      summary: 'ok',
    });
    expect(out.status).toBe('gaps');
    expect(out.missingCoverage[0].severity).toBe('recommended');
    expect(out.missingCoverage[1].severity).toBe('critical');
  });

  it('returns empty missing list when input is malformed', () => {
    const out = sanitiseCoverage({ missingCoverage: 'not an array' });
    expect(out.missingCoverage).toEqual([]);
    expect(out.summary).toBe('');
  });
});

describe('sanitiseReplan', () => {
  const input: ReplanDayInput = {
    projectId: '00000000-0000-0000-0000-000000000001',
    dayId: 'day-1',
    shotsCompleted: [],
    shotsRemaining: [
      { id: 'a', shotType: 'wide' },
      { id: 'b', shotType: 'cu' },
      { id: 'c', shotType: 'ots' },
    ],
    minutesRemaining: 60,
  };

  it('drops shot ids that are not in remaining list', () => {
    const out = sanitiseReplan(
      {
        recommendation: {
          keep: ['a', 'ghost'],
          combine: [{ shotIds: ['b', 'c', 'ghost'], note: 'merge' }],
          push: [{ shotId: 'ghost', suggestedPickupNote: 'x' }],
          drop: [{ shotId: 'c', reasoning: 'redundant' }],
        },
        summary: 's',
        riskLevel: 'high',
      },
      input,
    );
    expect(out.recommendation.keep).toEqual(['a']);
    expect(out.recommendation.combine[0].shotIds).toEqual(['b', 'c']);
    expect(out.recommendation.push).toEqual([]);
    expect(out.recommendation.drop).toEqual([{ shotId: 'c', reasoning: 'redundant' }]);
    expect(out.riskLevel).toBe('high');
  });

  it('filters combine entries with fewer than 2 valid ids', () => {
    const out = sanitiseReplan(
      { recommendation: { combine: [{ shotIds: ['a'], note: 'single' }] } },
      input,
    );
    expect(out.recommendation.combine).toEqual([]);
  });

  it('defaults riskLevel to medium when missing', () => {
    const out = sanitiseReplan({}, input);
    expect(out.riskLevel).toBe('medium');
  });
});

describe('sanitiseContinuity', () => {
  const input: ContinuityCheckInput = {
    projectId: '00000000-0000-0000-0000-000000000001',
    sceneId: 'scene-1',
    newShot: { id: 'new', notes: 'coffee in left hand' },
    previousShots: [
      { id: 'prev-1', notes: 'coffee in right hand' },
      { id: 'prev-2', notes: '' },
    ],
  };

  it('derives status=conflicts when any critical conflict present', () => {
    const out = sanitiseContinuity(
      {
        conflicts: [
          {
            type: 'prop',
            description: 'hand swap',
            severity: 'critical',
            referenceShotIds: ['prev-1', 'ghost'],
          },
        ],
      },
      input,
    );
    expect(out.status).toBe('conflicts');
    expect(out.conflicts[0].referenceShotIds).toEqual(['prev-1']);
  });

  it('derives status=warnings when only non-critical conflicts present', () => {
    const out = sanitiseContinuity(
      { conflicts: [{ type: 'time', description: 'x', severity: 'info' }] },
      input,
    );
    expect(out.status).toBe('warnings');
  });

  it('derives status=clean when no conflicts', () => {
    const out = sanitiseContinuity({ conflicts: [] }, input);
    expect(out.status).toBe('clean');
  });
});

describe('sanitiseEndOfDay', () => {
  const input: EndOfDayInput = {
    projectId: '00000000-0000-0000-0000-000000000001',
    dayId: 'day-1',
    shotsCompleted: [{ id: 's1' }, { id: 's2' }, { id: 's3' }],
    shotsMissing: [{ id: 's4' }],
    crew: [],
    issues: [],
  };

  it('uses counts from input, not from Claude output', () => {
    const out = sanitiseEndOfDay(
      {
        summary: {
          shotsCompleted: 999,
          shotsMissing: 999,
          highlights: ['strong perf'],
          concerns: ['storm'],
        },
        tomorrowBrief: { priority: ['scene 4'], editorNeeds: ['dailies'] },
        crewMessageDraft: 'wrapped. call at 07:00.',
      },
      input,
    );
    expect(out.summary.shotsCompleted).toBe(3);
    expect(out.summary.shotsMissing).toBe(1);
    expect(out.summary.highlights).toEqual(['strong perf']);
    expect(out.tomorrowBrief.priority).toEqual(['scene 4']);
    expect(out.crewMessageDraft).toBe('wrapped. call at 07:00.');
  });

  it('returns stable shape when Claude returns nothing', () => {
    const out = sanitiseEndOfDay({}, input);
    expect(out.summary.highlights).toEqual([]);
    expect(out.summary.concerns).toEqual([]);
    expect(out.tomorrowBrief.priority).toEqual([]);
    expect(out.crewMessageDraft).toBe('');
  });
});
