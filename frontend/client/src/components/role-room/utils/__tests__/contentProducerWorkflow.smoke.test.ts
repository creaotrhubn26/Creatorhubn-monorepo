import { describe, expect, it } from 'vitest';
import {
  deriveActiveWorkflowStep,
  deriveCompletedWorkflowSteps,
} from '../contentProducerWorkflow';

describe('Sprint 3.1 — deriveActiveWorkflowStep', () => {
  it('returns null for overview surface (no specific step active yet)', () => {
    expect(deriveActiveWorkflowStep('overview')).toBeNull();
  });

  it('returns null for unknown / nullish surface', () => {
    expect(deriveActiveWorkflowStep(null)).toBeNull();
    expect(deriveActiveWorkflowStep(undefined)).toBeNull();
    expect(deriveActiveWorkflowStep('unknown-surface')).toBeNull();
  });

  it('maps approval/delivery/economy surfaces to their step keys', () => {
    expect(deriveActiveWorkflowStep('approval')).toBe('approval');
    expect(deriveActiveWorkflowStep('delivery')).toBe('delivery');
    expect(deriveActiveWorkflowStep('economy')).toBe('economy');
  });

  it('defaults project_room to brief when no workspace focus is set', () => {
    expect(deriveActiveWorkflowStep('project_room')).toBe('brief');
    expect(deriveActiveWorkflowStep('project_room', null)).toBe('brief');
    expect(deriveActiveWorkflowStep('project_room', 'brief')).toBe('brief');
  });

  it('maps storyboard workspace to storyboard step', () => {
    expect(deriveActiveWorkflowStep('project_room', 'storyboard')).toBe('storyboard');
  });

  it('maps manuscript/shotlist workspace to story step', () => {
    expect(deriveActiveWorkflowStep('project_room', 'manuscript')).toBe('story');
    expect(deriveActiveWorkflowStep('project_room', 'shotlist')).toBe('story');
  });

  it('falls back to brief for unknown workspace inside project_room', () => {
    expect(deriveActiveWorkflowStep('project_room', 'materials')).toBe('brief');
    expect(deriveActiveWorkflowStep('project_room', 'brand')).toBe('brief');
  });
});

describe('Sprint 3.1 — deriveCompletedWorkflowSteps', () => {
  it('returns empty list when status is null/undefined/planning', () => {
    expect(deriveCompletedWorkflowSteps(null)).toEqual([]);
    expect(deriveCompletedWorkflowSteps(undefined)).toEqual([]);
    expect(deriveCompletedWorkflowSteps('planning')).toEqual([]);
  });

  it('marks brief/story/storyboard as completed when awaiting_client', () => {
    expect(deriveCompletedWorkflowSteps('awaiting_client')).toEqual([
      'brief',
      'story',
      'storyboard',
    ]);
  });

  it('marks brief/story/storyboard as completed when changes_requested', () => {
    expect(deriveCompletedWorkflowSteps('changes_requested')).toEqual([
      'brief',
      'story',
      'storyboard',
    ]);
  });

  it('marks brief/story/storyboard/approval as completed when approved', () => {
    expect(deriveCompletedWorkflowSteps('approved')).toEqual([
      'brief',
      'story',
      'storyboard',
      'approval',
    ]);
  });

  it('inkluderer delivery/economy når de er eksplisitt markert fullført', () => {
    expect(
      deriveCompletedWorkflowSteps('approved', { delivery: '2026-06-01T10:00:00.000Z', economy: '2026-06-01T11:00:00.000Z' }),
    ).toEqual(['brief', 'story', 'storyboard', 'approval', 'delivery', 'economy']);
  });

  it('kan markere delivery/economy fullført uavhengig av review-status (planning)', () => {
    expect(deriveCompletedWorkflowSteps('planning', { delivery: '2026-06-01T10:00:00.000Z' })).toEqual(['delivery']);
    expect(deriveCompletedWorkflowSteps('planning', { economy: '2026-06-01T10:00:00.000Z' })).toEqual(['economy']);
  });

  it('ignorerer null/tomme fase-flagg', () => {
    expect(deriveCompletedWorkflowSteps('planning', { delivery: null, economy: null })).toEqual([]);
    expect(deriveCompletedWorkflowSteps('approved', {})).toEqual(['brief', 'story', 'storyboard', 'approval']);
    expect(deriveCompletedWorkflowSteps('approved', null)).toEqual(['brief', 'story', 'storyboard', 'approval']);
  });
});
