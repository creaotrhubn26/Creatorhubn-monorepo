import { describe, expect, it } from 'vitest';

import {
  screenplayElementFromShortcutKey,
  screenplayElementShortcutLabel,
} from './screenplayElementShortcuts';

describe('screenplay element shortcuts', () => {
  it('maps the Final Draft-style number row to screenplay elements', () => {
    expect(screenplayElementFromShortcutKey('1')).toBe('scene_heading');
    expect(screenplayElementFromShortcutKey('2')).toBe('action');
    expect(screenplayElementFromShortcutKey('3')).toBe('character');
    expect(screenplayElementFromShortcutKey('4')).toBe('parenthetical');
    expect(screenplayElementFromShortcutKey('5')).toBe('dialogue');
    expect(screenplayElementFromShortcutKey('6')).toBe('transition');
    expect(screenplayElementFromShortcutKey('7')).toBeNull();
  });

  it('renders a platform-neutral shortcut hint', () => {
    expect(screenplayElementShortcutLabel('character')).toBe('⌘/Ctrl+3');
  });
});
