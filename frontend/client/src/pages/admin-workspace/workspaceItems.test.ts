/**
 * Tester for de rene funksjonene i workspace-registeret.
 *
 * Dekningen er ikke tilfeldig valgt: `parseWorkspaceLink` er kontrakten
 * som faktisk var brutt i produksjon (backend sendte `?sidebar=cases`,
 * frontend leste `?view=`, og ingen av delene ble oppdaget fordi det
 * eneste symptomet var en lenke som stille landet på feil flate).
 * `readViewFromUrl` er vernet mot den blanke skjermen en ukjent `?view=`
 * ga. Begge er billige å teste og dyre å ha feil.
 */

import { describe, expect, it } from 'vitest';

import {
  isWorkspaceItemId,
  parseWorkspaceLink,
  readViewFromUrl,
  scoreWorkspaceItem,
  searchWorkspaceItems,
  WORKSPACE_ITEMS,
} from './workspaceItems';

describe('isWorkspaceItemId', () => {
  it('godtar kjente id-er', () => {
    expect(isWorkspaceItemId('overview')).toBe(true);
    expect(isWorkspaceItemId('hr')).toBe(true);
  });

  it('avviser ukjente verdier og ikke-strenger', () => {
    expect(isWorkspaceItemId('tullball')).toBe(false);
    expect(isWorkspaceItemId('')).toBe(false);
    expect(isWorkspaceItemId(null)).toBe(false);
    expect(isWorkspaceItemId(42)).toBe(false);
    expect(isWorkspaceItemId(undefined)).toBe(false);
  });
});

describe('readViewFromUrl', () => {
  it('leser en gyldig view-parameter', () => {
    expect(readViewFromUrl('?view=cases')).toBe('cases');
  });

  it('faller tilbake til overview når parameteren mangler', () => {
    expect(readViewFromUrl('')).toBe('overview');
    expect(readViewFromUrl('?product=leadgrid')).toBe('overview');
  });

  it('faller tilbake ved ukjent flate — dette ga tidligere blank skjerm', () => {
    expect(readViewFromUrl('?view=slettet-flate')).toBe('overview');
  });

  it('respekterer et eget fallback', () => {
    expect(readViewFromUrl('?view=tull', 'inbox')).toBe('inbox');
  });
});

describe('parseWorkspaceLink', () => {
  it('leser view og caseId fra en workspace-lenke', () => {
    expect(parseWorkspaceLink('/admin-workspace?view=cases&caseId=abc-123')).toEqual({
      view: 'cases',
      caseId: 'abc-123',
    });
  });

  it('leser fundingId', () => {
    expect(parseWorkspaceLink('/admin-workspace?view=funding&fundingId=f1')).toEqual({
      view: 'funding',
      fundingId: 'f1',
    });
  });

  it('returnerer null for andre stier, så kalleren kan falle tilbake', () => {
    expect(parseWorkspaceLink('/admin-room?tab=funding&id=1')).toBeNull();
    expect(parseWorkspaceLink('/role-room/project/7')).toBeNull();
  });

  it('returnerer null når view mangler eller er ukjent', () => {
    expect(parseWorkspaceLink('/admin-workspace')).toBeNull();
    expect(parseWorkspaceLink('/admin-workspace?view=finnesikke')).toBeNull();
  });

  it('returnerer null for den GAMLE, ødelagte param-formen', () => {
    // Backend sendte ?sidebar=cases mens frontend leste ?view=. Lenken
    // så gyldig ut og landet stille på Oversikt. Regresjonsvern.
    expect(parseWorkspaceLink('/admin-workspace?sidebar=cases&caseId=abc')).toBeNull();
  });

  it('takler tomt, null og søppel uten å kaste', () => {
    expect(parseWorkspaceLink(null)).toBeNull();
    expect(parseWorkspaceLink(undefined)).toBeNull();
    expect(parseWorkspaceLink('')).toBeNull();
    expect(parseWorkspaceLink('::::')).toBeNull();
  });
});

describe('scoreWorkspaceItem', () => {
  const cockpit = WORKSPACE_ITEMS.find((i) => i.id === 'marketing-cockpit')!;

  it('rangerer eksakt treff høyest', () => {
    expect(scoreWorkspaceItem(cockpit, 'Marketing Cockpit')).toBeGreaterThan(
      scoreWorkspaceItem(cockpit, 'marketing'),
    );
  });

  it('gir prefiks bedre score enn subsekvens', () => {
    expect(scoreWorkspaceItem(cockpit, 'marketing')).toBeGreaterThan(
      scoreWorkspaceItem(cockpit, 'mkcp'),
    );
  });

  it('finner subsekvens-treff', () => {
    expect(scoreWorkspaceItem(cockpit, 'mkcp')).toBeGreaterThan(0);
  });

  it('matcher på keywords, ikke bare label', () => {
    const geo = WORKSPACE_ITEMS.find((i) => i.id === 'ai-citation')!;
    expect(scoreWorkspaceItem(geo, 'llm')).toBeGreaterThan(0);
  });

  it('gir 0 når ingenting matcher', () => {
    expect(scoreWorkspaceItem(cockpit, 'zzzzzz')).toBe(0);
  });

  it('gir alt treff på tom streng, så paletten viser hele listen', () => {
    expect(scoreWorkspaceItem(cockpit, '')).toBeGreaterThan(0);
    expect(scoreWorkspaceItem(cockpit, '   ')).toBeGreaterThan(0);
  });
});

describe('searchWorkspaceItems', () => {
  it('returnerer alle flatene ved tomt søk', () => {
    expect(searchWorkspaceItems('')).toHaveLength(WORKSPACE_ITEMS.length);
  });

  it('setter beste treff først', () => {
    const [first] = searchWorkspaceItems('kalender');
    expect(first.id).toBe('calendar');
  });

  it('filtrerer bort det som ikke matcher', () => {
    const results = searchWorkspaceItems('newsletter');
    expect(results.length).toBeGreaterThan(0);
    expect(results.length).toBeLessThan(WORKSPACE_ITEMS.length);
    expect(results.map((r) => r.id)).toContain('newsletter-studio');
  });

  it('gir tom liste når ingenting matcher', () => {
    expect(searchWorkspaceItems('qqqzzz')).toEqual([]);
  });
});

describe('registeret', () => {
  it('har unike id-er', () => {
    const ids = WORKSPACE_ITEMS.map((i) => i.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('har ingen ubygde flater — alt skal ha ekte innhold', () => {
    const planned = WORKSPACE_ITEMS.filter((i) => i.status === 'planned');
    expect(planned.map((p) => p.id)).toEqual([]);
  });
});
