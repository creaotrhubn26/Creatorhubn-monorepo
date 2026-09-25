import { describe, expect, it } from 'vitest';
import { isEditableShortcutTarget, resolveMediaRoomShortcut } from './mediaRoomShortcuts';

describe('media room shortcuts', () => {
  it('maps navigation, review and command shortcuts', () => {
    expect(resolveMediaRoomShortcut(new KeyboardEvent('keydown', { key: 'ArrowRight' }))).toBe('next');
    expect(resolveMediaRoomShortcut(new KeyboardEvent('keydown', { key: 'ArrowLeft', shiftKey: true }))).toBe('extendPrevious');
    expect(resolveMediaRoomShortcut(new KeyboardEvent('keydown', { key: 'k', metaKey: true }))).toBe('commands');
    expect(resolveMediaRoomShortcut(new KeyboardEvent('keydown', { key: '4' }))).toBe('rate4');
  });

  it('recognizes nested editable controls', () => {
    const input = document.createElement('input');
    const combobox = document.createElement('div');
    combobox.setAttribute('role', 'combobox');
    const child = document.createElement('span');
    combobox.appendChild(child);
    expect(isEditableShortcutTarget(input)).toBe(true);
    expect(isEditableShortcutTarget(child)).toBe(true);
    expect(isEditableShortcutTarget(document.createElement('button'))).toBe(false);
  });
});
