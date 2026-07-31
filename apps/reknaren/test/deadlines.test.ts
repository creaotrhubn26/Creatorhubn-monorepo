/**
 * Frister & forpliktelser: deterministiske lovbestemte frister med nedtelling.
 */
import { describe, expect, it } from 'vitest';
import { computeDeadlines } from '../src/ledger/deadlines.js';

describe('computeDeadlines', () => {
  it('ENK, mva-registrert: MVA-terminer, forskuddsskatt (4 terminer), skattemelding', () => {
    const ds = computeDeadlines({ orgForm: 'ENK', vatRegistered: true, asOf: '2026-03-01' });
    const mva = ds.find((d) => d.kind === 'mva' && d.title.includes('januar–februar 2026'));
    expect(mva!.dueDate).toBe('2026-04-10'); // 10. i (feb+2)=april
    expect(ds.some((d) => d.kind === 'forskuddsskatt' && d.dueDate === '2026-03-15')).toBe(true);
    expect(ds.find((d) => d.kind === 'skattemelding' && d.title.includes('2025'))!.dueDate).toBe('2026-05-31');
    // ENK har ikke aksjonærregister/årsregnskap.
    expect(ds.some((d) => d.kind === 'aksjonaerregister' || d.kind === 'aarsregnskap')).toBe(false);
  });

  it('AS: forskuddsskatt (2 terminer), aksjonærregister, årsregnskap', () => {
    const ds = computeDeadlines({ orgForm: 'AS', vatRegistered: true, asOf: '2026-03-01' });
    expect(ds.some((d) => d.kind === 'forskuddsskatt' && d.dueDate === '2026-02-15')).toBe(true);
    expect(ds.find((d) => d.kind === 'aksjonaerregister')!.dueDate).toBe('2026-01-31');
    expect(ds.find((d) => d.kind === 'aarsregnskap')!.dueDate).toBe('2026-07-31');
  });

  it('ikke mva-registrert → ingen MVA-frister', () => {
    const ds = computeDeadlines({ orgForm: 'ENK', vatRegistered: false, asOf: '2026-03-01' });
    expect(ds.some((d) => d.kind === 'mva')).toBe(false);
  });

  it('setter status: forfalt / snart / kommende', () => {
    const ds = computeDeadlines({ orgForm: 'AS', vatRegistered: true, asOf: '2026-03-01' });
    // 2026-02-15 forskuddsskatt er forfalt (14 dager siden).
    const overdue = ds.find((d) => d.dueDate === '2026-02-15')!;
    expect(overdue.severity).toBe('overdue');
    expect(overdue.daysUntil).toBeLessThan(0);
    // Noe ~10 dager frem = due_soon.
    const soon = computeDeadlines({ orgForm: 'ENK', vatRegistered: true, asOf: '2026-03-05' }).find((d) => d.dueDate === '2026-03-15')!;
    expect(soon.severity).toBe('due_soon');
  });

  it('sortert stigende på dato', () => {
    const ds = computeDeadlines({ orgForm: 'AS', vatRegistered: true, asOf: '2026-03-01' });
    const dates = ds.map((d) => d.dueDate);
    expect([...dates].sort()).toEqual(dates);
  });
});
