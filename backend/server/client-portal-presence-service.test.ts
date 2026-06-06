import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  markClientPresent,
  markClientAbsent,
  clientsForProject,
} from './client-portal-presence-service.js';

// Modulen er stateful (in-memory map). Vi bruker unike projectId-er per test
// for å unngå kryss-kontaminering uten en "clear all"-eksport.
describe('client-portal-presence-service', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('markClientPresent gjør klienten synlig via clientsForProject', () => {
    markClientPresent('proj-1', 'helene.nygard@northwinddrilling.no', 'Helene Nygard', 'marketing-plan');
    const clients = clientsForProject('proj-1');
    expect(clients).toHaveLength(1);
    expect(clients[0].email).toBe('helene.nygard@northwinddrilling.no');
    expect(clients[0].name).toBe('Helene Nygard');
    expect(clients[0].workspace).toBe('marketing-plan');
  });

  it('er case-insensitiv på e-post (re-heartbeat oppdaterer samme entry)', () => {
    markClientPresent('proj-2', 'Klient@Eksempel.no', 'Klient', null);
    markClientPresent('proj-2', 'klient@eksempel.no', 'Klient', null);
    expect(clientsForProject('proj-2')).toHaveLength(1);
  });

  it('sorterer flere klienter nyeste-først', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-06-01T10:00:00Z'));
    markClientPresent('proj-3', 'a@x.no', 'A', null);
    vi.setSystemTime(new Date('2026-06-01T10:00:05Z'));
    markClientPresent('proj-3', 'b@x.no', 'B', null);
    const clients = clientsForProject('proj-3');
    expect(clients.map((c) => c.email)).toEqual(['b@x.no', 'a@x.no']);
  });

  it('markClientAbsent fjerner klienten', () => {
    markClientPresent('proj-4', 'c@x.no', 'C', null);
    expect(clientsForProject('proj-4')).toHaveLength(1);
    markClientAbsent('proj-4', 'c@x.no');
    expect(clientsForProject('proj-4')).toHaveLength(0);
  });

  it('filtrerer ut stale entries (eldre enn stale-vinduet)', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-06-01T10:00:00Z'));
    markClientPresent('proj-5', 'd@x.no', 'D', null);
    expect(clientsForProject('proj-5')).toHaveLength(1);
    // 91 sek senere — utenfor 90-sek stale-vinduet.
    vi.setSystemTime(new Date('2026-06-01T10:01:31Z'));
    expect(clientsForProject('proj-5')).toHaveLength(0);
  });

  it('beholder joinedAt på tvers av re-heartbeats', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-06-01T10:00:00Z'));
    markClientPresent('proj-6', 'e@x.no', 'E', null);
    const joinedAt = clientsForProject('proj-6')[0].joinedAt;
    vi.setSystemTime(new Date('2026-06-01T10:00:20Z'));
    markClientPresent('proj-6', 'e@x.no', 'E', null);
    const after = clientsForProject('proj-6')[0];
    expect(after.joinedAt).toBe(joinedAt);
    expect(after.lastSeenAt).toBeGreaterThan(joinedAt);
  });
});
