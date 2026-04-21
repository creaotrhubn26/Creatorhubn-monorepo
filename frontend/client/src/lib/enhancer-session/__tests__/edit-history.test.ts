import { describe, expect, it } from 'vitest';
import {
  canRedo,
  canUndo,
  clearHistory,
  EMPTY_HISTORY,
  pushHistoryEntry,
  stepRedo,
  stepUndo,
  type EditHistory,
  type EditHistoryEntry,
} from '../edit-history';
import { DEFAULT_SETTINGS, type EnhancementSettings } from '../module-contract';

function snapshot(brightness: number, label?: string): EditHistoryEntry {
  const settings: EnhancementSettings = { ...DEFAULT_SETTINGS, brightness };
  return { at: Date.now(), settings, changedModules: ['color'], label };
}

function withCapacity(capacity: number): EditHistory {
  return { ...EMPTY_HISTORY, capacity };
}

describe('pushHistoryEntry', () => {
  it('advances index on every new push', () => {
    let history = EMPTY_HISTORY;
    history = pushHistoryEntry(history, snapshot(0));
    expect(history.index).toBe(0);
    history = pushHistoryEntry(history, snapshot(5));
    expect(history.index).toBe(1);
    history = pushHistoryEntry(history, snapshot(10));
    expect(history.index).toBe(2);
    expect(history.entries.length).toBe(3);
  });

  it('no-ops when snapshot equals the current entry', () => {
    let history = EMPTY_HISTORY;
    history = pushHistoryEntry(history, snapshot(5));
    const before = history;
    history = pushHistoryEntry(history, snapshot(5));
    expect(history).toBe(before);
  });

  it('truncates forward entries when pushing after an undo (branching)', () => {
    let history = EMPTY_HISTORY;
    history = pushHistoryEntry(history, snapshot(0));
    history = pushHistoryEntry(history, snapshot(10));
    history = pushHistoryEntry(history, snapshot(20));
    const undone = stepUndo(history).history; // now at index 1
    const branched = pushHistoryEntry(undone, snapshot(15));
    expect(branched.entries.length).toBe(3);
    expect(branched.entries.map((e) => e.settings.brightness)).toEqual([0, 10, 15]);
    expect(canRedo(branched)).toBe(false);
  });

  it('drops the oldest entry when capacity is exceeded', () => {
    let history = withCapacity(3);
    history = pushHistoryEntry(history, snapshot(1));
    history = pushHistoryEntry(history, snapshot(2));
    history = pushHistoryEntry(history, snapshot(3));
    history = pushHistoryEntry(history, snapshot(4));
    expect(history.entries.length).toBe(3);
    expect(history.entries.map((e) => e.settings.brightness)).toEqual([2, 3, 4]);
    expect(history.index).toBe(2);
  });
});

describe('stepUndo / stepRedo', () => {
  const seeded = (() => {
    let h: EditHistory = EMPTY_HISTORY;
    h = pushHistoryEntry(h, snapshot(0, 'initial'));
    h = pushHistoryEntry(h, snapshot(10, 'nudge'));
    h = pushHistoryEntry(h, snapshot(20, 'another'));
    return h;
  })();

  it('walks pointer backward on undo and returns the prior snapshot', () => {
    const { history, snapshot: restored } = stepUndo(seeded);
    expect(history.index).toBe(1);
    expect(restored?.settings.brightness).toBe(10);
  });

  it('is a no-op when there is nothing to undo', () => {
    let h: EditHistory = EMPTY_HISTORY;
    h = pushHistoryEntry(h, snapshot(5));
    const { history } = stepUndo(h);
    expect(history.index).toBe(0);
    expect(canUndo(history)).toBe(false);
  });

  it('walks pointer forward on redo and returns the later snapshot', () => {
    const undone = stepUndo(seeded).history;
    const { history, snapshot: restored } = stepRedo(undone);
    expect(history.index).toBe(seeded.index);
    expect(restored?.settings.brightness).toBe(20);
  });

  it('is a no-op when there is nothing to redo', () => {
    const { history } = stepRedo(seeded);
    expect(history).toEqual(seeded);
  });
});

describe('canUndo / canRedo', () => {
  it('returns false on an empty history', () => {
    expect(canUndo(EMPTY_HISTORY)).toBe(false);
    expect(canRedo(EMPTY_HISTORY)).toBe(false);
  });

  it('returns true on a history with two+ entries at the head', () => {
    let h: EditHistory = EMPTY_HISTORY;
    h = pushHistoryEntry(h, snapshot(0));
    h = pushHistoryEntry(h, snapshot(5));
    expect(canUndo(h)).toBe(true);
    expect(canRedo(h)).toBe(false);
  });

  it('returns true for redo after at least one undo', () => {
    let h: EditHistory = EMPTY_HISTORY;
    h = pushHistoryEntry(h, snapshot(0));
    h = pushHistoryEntry(h, snapshot(5));
    const undone = stepUndo(h).history;
    expect(canRedo(undone)).toBe(true);
  });
});

describe('clearHistory', () => {
  it('resets to empty while preserving capacity', () => {
    let h = withCapacity(50);
    h = pushHistoryEntry(h, snapshot(0));
    const cleared = clearHistory(h);
    expect(cleared.entries).toEqual([]);
    expect(cleared.index).toBe(-1);
    expect(cleared.capacity).toBe(50);
  });
});
