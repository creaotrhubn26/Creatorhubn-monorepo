// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from 'vitest';
import type { LocationManagerOperations } from '../models/casting';
import { locationManagerOfflineStore } from './locationManagerOfflineStore';

const operations = (nextAction: string): LocationManagerOperations => ({
  stage: 'scouting',
  decisionStatus: 'shortlisted',
  ownerCommunication: { status: 'contacted' },
  dateAvailability: { status: 'requested', confirmedDates: [] },
  recce: { status: 'not_started', attendees: [] },
  clearanceGates: [],
  logistics: {},
  finance: { currency: 'NOK', locationFee: 0, permitFees: 0, restorationReserve: 0, status: 'estimate' },
  risks: [],
  scoutCapture: {
    conditions: { ambientNoise: 'unknown', mobileSignal: 'unknown', power: 'unknown' },
    checks: [],
  },
  nextAction,
  activity: [],
});

describe('locationManagerOfflineStore', () => {
  afterEach(() => {
    localStorage.clear();
    vi.unstubAllGlobals();
  });

  it('merges repeated offline saves for one location without advancing the server version', async () => {
    vi.stubGlobal('indexedDB', undefined);
    await locationManagerOfflineStore.put({
      projectId: 'troll', locationId: 'dovre', expectedVersion: 4, operations: operations('Første feltendring'),
    });
    await locationManagerOfflineStore.put({
      projectId: 'troll', locationId: 'dovre', expectedVersion: 99, operations: operations('Siste feltendring'),
    });

    const pending = await locationManagerOfflineStore.list('troll');
    expect(pending).toHaveLength(1);
    expect(pending[0]).toEqual(expect.objectContaining({ expectedVersion: 4 }));
    expect(pending[0].operations.nextAction).toBe('Siste feltendring');
  });
});
