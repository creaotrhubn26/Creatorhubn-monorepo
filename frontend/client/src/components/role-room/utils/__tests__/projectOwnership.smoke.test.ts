import { describe, expect, it } from 'vitest';
import { evaluateProjectOwnership } from '../projectOwnership';

describe('Sprint 1.3 — evaluateProjectOwnership', () => {
  it('does not warn when user matches by ownerId', () => {
    const result = evaluateProjectOwnership(
      { ownerId: 'user-42' },
      { id: 'user-42', email: 'daniel@creatorhubn.com' },
    );
    expect(result).toEqual({ warn: false });
  });

  it('does not warn when user matches by ownerEmail (case-insensitive)', () => {
    const result = evaluateProjectOwnership(
      { ownerEmail: 'Daniel@CreatorHubn.com' },
      { id: 'something-else', email: 'daniel@creatorhubn.com' },
    );
    expect(result).toEqual({ warn: false });
  });

  it('warns when ownerId differs from logged-in user id', () => {
    const result = evaluateProjectOwnership(
      { ownerId: 'other-user-1' },
      { id: 'user-42', email: 'daniel@creatorhubn.com' },
    );
    expect(result).toMatchObject({
      warn: true,
      ownerLabel: 'other-user-1',
      currentLabel: 'daniel@creatorhubn.com',
    });
  });

  it('warns when ownerEmail differs from logged-in user email', () => {
    const result = evaluateProjectOwnership(
      { ownerEmail: 'someone-else@example.com' },
      { id: '7', email: 'daniel@creatorhubn.com' },
    );
    expect(result).toMatchObject({
      warn: true,
      ownerLabel: 'someone-else@example.com',
      currentLabel: 'daniel@creatorhubn.com',
    });
  });

  it('uses snake_case owner_id/owner_email when those are the only available fields', () => {
    const result = evaluateProjectOwnership(
      { owner_id: 'snake-owner', owner_email: 'snake@example.com' },
      { id: 'user-42', email: 'daniel@creatorhubn.com' },
    );
    expect(result).toMatchObject({
      warn: true,
      ownerLabel: 'snake@example.com',
    });
  });

  it('does not warn when project has no owner info at all', () => {
    const result = evaluateProjectOwnership(
      {},
      { id: 'user-42', email: 'daniel@creatorhubn.com' },
    );
    expect(result).toEqual({ warn: false });
  });

  it('does not warn when user is unauthenticated', () => {
    const result = evaluateProjectOwnership(
      { ownerId: 'other-user' },
      { id: null, email: null },
    );
    expect(result).toEqual({ warn: false });
  });

  it('does not warn when project is null/undefined (defensive)', () => {
    expect(evaluateProjectOwnership(null, { id: 'u', email: 'e' })).toEqual({ warn: false });
    expect(evaluateProjectOwnership(undefined, { id: 'u', email: 'e' })).toEqual({ warn: false });
  });

  it('treats numeric ids correctly when compared to string ownerId', () => {
    // Backend kan returnere user.id som number, owner som string.
    const result = evaluateProjectOwnership(
      { ownerId: '42' },
      { id: 42, email: 'daniel@creatorhubn.com' },
    );
    expect(result).toEqual({ warn: false });
  });
});
