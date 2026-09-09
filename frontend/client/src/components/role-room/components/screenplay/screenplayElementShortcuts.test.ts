import { describe, expect, it } from 'vitest';

import {
  findScreenplayShortcutConflicts,
  formatLineAsScreenplayElement,
  getNextScreenplayElement,
  getScreenplayParagraphSeparator,
  screenplayElementFromShortcutKey,
  screenplayElementShortcutLabel,
  screenplayShortcutFromEvent,
  sanitizeScreenplayShortcutOverrides,
} from './screenplayElementShortcuts';

describe('screenplay element shortcuts', () => {
  it('maps the Final Draft-style number row to screenplay elements', () => {
    expect(screenplayElementFromShortcutKey('0')).toBe('action');
    expect(screenplayElementFromShortcutKey('1')).toBe('scene_heading');
    expect(screenplayElementFromShortcutKey('2')).toBe('action');
    expect(screenplayElementFromShortcutKey('3')).toBe('character');
    expect(screenplayElementFromShortcutKey('4')).toBe('parenthetical');
    expect(screenplayElementFromShortcutKey('5')).toBe('dialogue');
    expect(screenplayElementFromShortcutKey('6')).toBe('transition');
    expect(screenplayElementFromShortcutKey('7')).toBe('shot');
    expect(screenplayElementFromShortcutKey('8')).toBeNull();
  });

  it('renders platform-specific shortcut hints', () => {
    expect(screenplayElementShortcutLabel('character', 'mac')).toBe('⌘3');
    expect(screenplayElementShortcutLabel('character', 'windows')).toBe('Ctrl+3');
  });

  it('keeps Final Draft-style Enter and Tab transitions in one registry', () => {
    expect(getNextScreenplayElement('scene_heading', 'enter')).toBe('action');
    expect(getNextScreenplayElement('action', 'tab')).toBe('character');
    expect(getNextScreenplayElement('character', 'enter')).toBe('dialogue');
    expect(getNextScreenplayElement('character', 'tab')).toBe('parenthetical');
    expect(getNextScreenplayElement('dialogue', 'enter')).toBe('action');
    expect(getNextScreenplayElement('dialogue', 'tab')).toBe('character');
    expect(getNextScreenplayElement('parenthetical', 'tab', true)).toBe('character');
    expect(getScreenplayParagraphSeparator('character', 'dialogue')).toBe('\n');
    expect(getScreenplayParagraphSeparator('dialogue', 'action')).toBe('\n\n');
  });

  it('formats only when an explicit element command is used', () => {
    expect(formatLineAsScreenplayElement('museum', 'scene_heading')).toEqual({
      text: 'INT. MUSEUM - DAY',
      cursorOffset: 17,
    });
    expect(formatLineAsScreenplayElement('', 'parenthetical')).toEqual({
      text: '()',
      cursorOffset: 1,
    });
  });

  it('matches physical number-row codes independently of keyboard layout', () => {
    const windowsCommand = screenplayShortcutFromEvent({
      code: 'Digit3',
      key: '#',
      ctrlKey: true,
      metaKey: false,
      shiftKey: false,
      altKey: false,
    }, {}, 'windows');
    expect(windowsCommand?.id).toBe('character');

    const macCommand = screenplayShortcutFromEvent({
      code: 'Digit3',
      key: '£',
      ctrlKey: false,
      metaKey: true,
      shiftKey: false,
      altKey: false,
    }, {}, 'mac');
    expect(macCommand?.id).toBe('character');
  });

  it('detects custom collisions with editor and reserved Role Room commands', () => {
    expect(findScreenplayShortcutConflicts({
      action: { code: 'Digit3', keyLabel: '3', modifiers: ['primary'] },
    }, 'windows')).toContain('Action / Character');

    expect(findScreenplayShortcutConflicts({
      character: { code: 'Tab', keyLabel: 'Tab', modifiers: ['primary'] },
    }, 'windows')).toContain('Character / Grammar suggestions');
  });

  it('drops malformed persisted shortcut settings', () => {
    expect(sanitizeScreenplayShortcutOverrides({
      character: { code: 'KeyK', keyLabel: 'K', modifiers: ['primary'] },
      dialogue: { code: '', keyLabel: 'D', modifiers: ['primary'] },
      unknown: { code: 'KeyX', keyLabel: 'X', modifiers: ['primary'] },
    })).toEqual({
      character: { code: 'KeyK', keyLabel: 'K', modifiers: ['primary'] },
    });
  });
});
