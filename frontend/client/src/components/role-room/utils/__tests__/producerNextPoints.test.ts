import { describe, expect, it } from 'vitest';
import { deriveContentLogicPoints, deriveAccessPoints } from '../producerNextPoints';

describe('deriveContentLogicPoints (samlet sjekkliste)', () => {
  it('flagger manglende kjernefelt + tomme proof/signals', () => {
    const r = deriveContentLogicPoints({ objective: 'Vekst', audience: '', hook: '', coreMessage: 'X', callToAction: '', distributionPlan: '', proofPoints: [], successSignals: [] });
    // mangler: audience, hook, callToAction, distributionPlan = 4 felt; + ingen proof + ingen signals
    expect(r.openCount).toBe(4 + 1 + 1);
    expect(r.points.find((p) => p.key === 'missing-fields')?.count).toBe(4);
  });

  it('teller proof points / success signals når de finnes', () => {
    const r = deriveContentLogicPoints({
      objective: 'a', audience: 'b', hook: 'c', coreMessage: 'd', callToAction: 'e', distributionPlan: 'f',
      proofPoints: ['p1', 'p2'], successSignals: ['s1'],
    });
    expect(r.openCount).toBe(0);
    expect(r.points.some((p) => p.key === 'complete')).toBe(true);
  });
});

describe('deriveAccessPoints (kontotilgang)', () => {
  it('teller kontoer som mangler tilgang + venter på klient', () => {
    const r = deriveAccessPoints({ requiredPlatformCount: 3, connectedCount: 1, clientActionCount: 1, inviteSentCount: 0 });
    expect(r.openCount).toBe(2); // 3 - 1 = 2 mangler
    expect(r.points.find((p) => p.key === 'client-action')?.count).toBe(1);
    expect(r.points.find((p) => p.key === 'missing')?.count).toBe(2);
  });

  it('alt tilkoblet → ingen åpne', () => {
    const r = deriveAccessPoints({ requiredPlatformCount: 2, connectedCount: 2, clientActionCount: 0, inviteSentCount: 0 });
    expect(r.openCount).toBe(0);
    expect(r.points.some((p) => p.key === 'all-connected')).toBe(true);
  });

  it('ingen kontoer kreves → info, ingen åpne', () => {
    const r = deriveAccessPoints({ requiredPlatformCount: 0 });
    expect(r.openCount).toBe(0);
    expect(r.points[0].key).toBe('none-required');
  });
});
