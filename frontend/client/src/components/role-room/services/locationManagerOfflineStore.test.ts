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
    observations: [],
    pins: [],
  },
  decisionReview: {
    criteria: [],
    signoffs: [
      { role: 'director', status: 'pending' },
      { role: 'cinematographer', status: 'pending' },
      { role: 'producer', status: 'pending' },
    ],
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

  it('never falls back to localStorage for queued media blobs', async () => {
    vi.stubGlobal('indexedDB', undefined);
    await expect(locationManagerOfflineStore.putMedia({
      projectId: 'troll',
      locationId: 'dovre',
      displayName: 'room.wav',
      contentType: 'audio/wav',
      sizeBytes: 12,
      blob: new Blob(['RIFF0000WAVE'], { type: 'audio/wav' }),
      upload: {
        clientUploadId: '11111111-1111-4111-8111-111111111111',
        kind: 'audio',
        metadata: { source: 'recorder', sceneIds: ['12A'] },
      },
    })).rejects.toThrow('IndexedDB');
    expect(localStorage.length).toBe(0);
  });
});
