import { describe, expect, it } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useProducerAccess } from './useProducerAccess';
import type { UserRole } from '../models/casting';

function makeRole(role: UserRole['role'], permissions: UserRole['permissions'] = {}): UserRole {
  return {
    id: `role-${role}`,
    role,
    permissions,
  };
}

describe('useProducerAccess', () => {
  it('maps content producer to producer-mode permissions', () => {
    const { result } = renderHook(() =>
      useProducerAccess(makeRole('content_producer', { canViewEconomy: true }), null),
    );

    expect(result.current.isContentProducerMode).toBe(true);
    expect(result.current.isProductionTeamMode).toBe(false);
    expect(result.current.isClientReviewerMode).toBe(false);
    expect(result.current.canEditProductionData).toBe(true);
    expect(result.current.canComment).toBe(true);
    expect(result.current.canRequestChanges).toBe(true);
    expect(result.current.canViewEconomy).toBe(true);
    expect(result.current.canMakeReviewDecision).toBe(false);
  });

  it('maps client reviewer to read/comment/decision without production edit', () => {
    const { result } = renderHook(() =>
      useProducerAccess(makeRole('client_reviewer', { canViewEconomy: false }), null),
    );

    expect(result.current.isClientReviewerMode).toBe(true);
    expect(result.current.isProductionTeamMode).toBe(false);
    expect(result.current.isContentProducerMode).toBe(false);
    expect(result.current.canEditProductionData).toBe(false);
    expect(result.current.canComment).toBe(true);
    expect(result.current.canRequestChanges).toBe(true);
    expect(result.current.canViewEconomy).toBe(false);
    expect(result.current.canMakeReviewDecision).toBe(true);
  });

  it('falls back to production-team mode for non-producer-specific roles', () => {
    const { result } = renderHook(() =>
      useProducerAccess(makeRole('producer', { canViewEconomy: true, canApprove: true }), null),
    );

    expect(result.current.isProductionTeamMode).toBe(true);
    expect(result.current.isContentProducerMode).toBe(false);
    expect(result.current.isClientReviewerMode).toBe(false);
    expect(result.current.canEditProductionData).toBe(true);
    expect(result.current.canMakeReviewDecision).toBe(true);
  });
});

