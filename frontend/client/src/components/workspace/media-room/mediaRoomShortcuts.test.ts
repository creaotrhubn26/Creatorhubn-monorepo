import { describe, expect, it } from 'vitest';
import { isEditableShortcutTarget, resolveMediaRoomShortcut } from './mediaRoomShortcuts';

describe('media room shortcuts', () => {
  it('maps navigation, review and command shortcuts', () => {
    expect(resolveMediaRoomShortcut(new KeyboardEvent('keydown', { key: 'ArrowRight' }))).toBe('next');
    expect(resolveMediaRoomShortcut(new KeyboardEvent('keydown', { key: 'ArrowLeft', shiftKey: true }))).toBe('extendPrevious');
    expect(resolveMediaRoomShortcut(new KeyboardEvent('keydown', { key: 'k', metaKey: true }))).toBe('commands');
    expect(resolveMediaRoomShortcut(new KeyboardEvent('keydown', { key: '4' }))).toBe('rate4');
  });

  it('leaves editable and interactive controls to their native keyboard behavior', () => {
    const input = document.createElement('input');
    const combobox = document.createElement('div');
    combobox.setAttribute('role', 'combobox');
    const child = document.createElement('span');
    combobox.appendChild(child);
    const button = document.createElement('button');
    const buttonIcon = document.createElement('span');
    button.appendChild(buttonIcon);
    const link = document.createElement('a');
    link.href = '/photo-room';
    expect(isEditableShortcutTarget(input)).toBe(true);
    expect(isEditableShortcutTarget(child)).toBe(true);
    expect(isEditableShortcutTarget(button)).toBe(true);
    expect(isEditableShortcutTarget(buttonIcon)).toBe(true);
    expect(isEditableShortcutTarget(link)).toBe(true);
    expect(isEditableShortcutTarget(document.createElement('div'))).toBe(false);
  });
});
