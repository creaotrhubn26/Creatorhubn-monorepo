export type KeyboardScreenplayElement =
  | 'scene_heading'
  | 'action'
  | 'character'
  | 'parenthetical'
  | 'dialogue'
  | 'transition';

export const SCREENPLAY_ELEMENT_SHORTCUTS: ReadonlyArray<{
  key: string;
  type: KeyboardScreenplayElement;
}> = [
  { key: '1', type: 'scene_heading' },
  { key: '2', type: 'action' },
  { key: '3', type: 'character' },
  { key: '4', type: 'parenthetical' },
  { key: '5', type: 'dialogue' },
  { key: '6', type: 'transition' },
];

export function screenplayElementFromShortcutKey(
  key: string,
): KeyboardScreenplayElement | null {
  return SCREENPLAY_ELEMENT_SHORTCUTS.find((shortcut) => shortcut.key === key)?.type ?? null;
}

export function screenplayElementShortcutLabel(type: KeyboardScreenplayElement): string {
  const shortcut = SCREENPLAY_ELEMENT_SHORTCUTS.find((entry) => entry.type === type);
  return shortcut ? `⌘/Ctrl+${shortcut.key}` : '';
}
