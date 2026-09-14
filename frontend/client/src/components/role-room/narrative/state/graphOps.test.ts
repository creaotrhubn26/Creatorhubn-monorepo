import { describe, expect, it } from 'vitest';
import { emptyGraph, type NarrativeElement, type NarrativeGraph } from '../narrativeTypes';
import { boardSlice, canConnect, validateGraph, withMoves, withoutElement } from './graphOps';
import { getTabsForProfession } from '../../config/professionTabs';

function el(over: Partial<NarrativeElement> & { id: string; boardId: string }): NarrativeElement {
  return {
    projectId: 'p1', kind: 'element', titleHtml: `<p>${over.id}</p>`, contentHtml: '', x: 0, y: 0, width: 260, height: 120,
    theme: 'default', coverAssetId: null, customId: null, jumperTargetId: null, branchConditions: [], version: 1, sortOrder: 0,
    createdAt: '', updatedAt: '', ...over,
  };
}

function graph(): NarrativeGraph {
  const g = emptyGraph('p1');
  g.boards = [{ id: 'b1', projectId: 'p1', name: 'Akt 1', customId: null, folderPath: '', sortOrder: 0, viewport: {}, createdAt: '', updatedAt: '' }];
  g.elements = [
    el({ id: 'start', boardId: 'b1' }),
    el({ id: 'choice', boardId: 'b1', kind: 'branch', branchConditions: [{ id: 'c1', script: 'gold >= 10', label: null }, { id: 'c2', script: null, label: 'else' }] }),
    el({ id: 'win', boardId: 'b1' }),
    el({ id: 'orphan', boardId: 'b1' }),
    el({ id: 'jump', boardId: 'b1', kind: 'jumper', jumperTargetId: 'orphan' }),
    el({ id: 'note', boardId: 'b1', kind: 'note' }),
  ];
  g.connections = [
    { id: 'k1', projectId: 'p1', boardId: 'b1', sourceId: 'start', targetId: 'choice', sourceOutputKey: 'default', labelHtml: '', sortOrder: 0, createdAt: '', updatedAt: '' },
    { id: 'k2', projectId: 'p1', boardId: 'b1', sourceId: 'choice', targetId: 'win', sourceOutputKey: 'c1', labelHtml: '', sortOrder: 0, createdAt: '', updatedAt: '' },
    { id: 'k3', projectId: 'p1', boardId: 'b1', sourceId: 'win', targetId: 'jump', sourceOutputKey: 'default', labelHtml: '', sortOrder: 0, createdAt: '', updatedAt: '' },
  ];
  g.settings.startingElementId = 'start';
  return g;
}

describe('professionTabs — game_studio', () => {
  it('har faner (default i getTabsForProfession returnerer tom liste stille)', () => {
    const tabs = getTabsForProfession('game_studio');
    expect(tabs.length).toBeGreaterThan(0);
    expect(tabs[0].id).toBe('boards');
  });
});

describe('graphOps', () => {
  it('canConnect følger Arcweave-reglene', () => {
    const g = graph();
    const byId = new Map(g.elements.map((e) => [e.id, e]));
    expect(canConnect(byId.get('start'), byId.get('win'))).toBe(true);
    expect(canConnect(byId.get('jump'), byId.get('win'))).toBe(false); // jumper: ingen utganger
    expect(canConnect(byId.get('note'), byId.get('win'))).toBe(false); // notat: ingen utganger
    expect(canConnect(byId.get('start'), byId.get('note'))).toBe(false); // notat: ingen innganger
    expect(canConnect(byId.get('start'), byId.get('start'))).toBe(false);
  });

  it('withoutElement fjerner koblinger, nullstiller jumper-mål og startelement', () => {
    const g = withoutElement(graph(), 'orphan');
    expect(g.elements.find((e) => e.id === 'jump')?.jumperTargetId).toBeNull();
    const g2 = withoutElement(graph(), 'start');
    expect(g2.settings.startingElementId).toBeNull();
    expect(g2.connections.some((c) => c.sourceId === 'start')).toBe(false);
  });

  it('withMoves oppdaterer kun de flyttede', () => {
    const g = withMoves(graph(), [{ id: 'win', x: 100, y: 200 }]);
    expect(g.elements.find((e) => e.id === 'win')).toMatchObject({ x: 100, y: 200 });
    expect(g.elements.find((e) => e.id === 'start')).toMatchObject({ x: 0, y: 0 });
  });

  it('boardSlice gir elementer + koblinger for brettet', () => {
    const s = boardSlice(graph(), 'b1');
    expect(s.elements).toHaveLength(6);
    expect(s.connections).toHaveLength(3);
    expect(boardSlice(graph(), null).elements).toHaveLength(0);
  });

  it('validateGraph finner ukoblet else-utgang; jumper-mål teller som inngang', () => {
    const issues = validateGraph(graph());
    expect(issues.some((i) => i.elementId === 'choice' && i.message.includes('else'))).toBe(true);
    // 'orphan' nås via jumper → ingen «kan ikke nås»-merknad
    expect(issues.some((i) => i.elementId === 'orphan')).toBe(false);
    // startelementet skal ikke få «kan ikke nås»
    expect(issues.some((i) => i.elementId === 'start')).toBe(false);
  });

  it('validateGraph varsler når startelement mangler', () => {
    const g = graph();
    g.settings.startingElementId = null;
    expect(validateGraph(g).some((i) => i.elementId === null)).toBe(true);
  });
});
