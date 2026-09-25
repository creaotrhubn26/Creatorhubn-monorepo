export type MediaRoomShortcutId =
  | 'previous'
  | 'next'
  | 'extendPrevious'
  | 'extendNext'
  | 'grid'
  | 'review'
  | 'compare'
  | 'fullscreen'
  | 'search'
  | 'selectAll'
  | 'clear'
  | 'approve'
  | 'needsChanges'
  | 'reject'
  | 'flag'
  | 'rate0'
  | 'rate1'
  | 'rate2'
  | 'rate3'
  | 'rate4'
  | 'rate5'
  | 'submit'
  | 'commands'
  | 'help';

export interface MediaRoomShortcutDefinition {
  id: MediaRoomShortcutId;
  keys: string;
  no: string;
  en: string;
}

export const MEDIA_ROOM_SHORTCUTS: MediaRoomShortcutDefinition[] = [
  { id: 'previous', keys: '←', no: 'Forrige element', en: 'Previous item' },
  { id: 'next', keys: '→', no: 'Neste element', en: 'Next item' },
  { id: 'extendPrevious', keys: 'Shift + ←', no: 'Utvid utvalg bakover', en: 'Extend selection backward' },
  { id: 'extendNext', keys: 'Shift + →', no: 'Utvid utvalg fremover', en: 'Extend selection forward' },
  { id: 'grid', keys: 'G', no: 'Bibliotek / rutenett', en: 'Library / grid' },
  { id: 'review', keys: 'E / Enter', no: 'Åpne reviewvisning', en: 'Open review view' },
  { id: 'compare', keys: 'C', no: 'Sammenlign valgte', en: 'Compare selected' },
  { id: 'fullscreen', keys: 'F', no: 'Fullskjerm', en: 'Fullscreen' },
  { id: 'search', keys: '/', no: 'Søk', en: 'Search' },
  { id: 'selectAll', keys: '⌘/Ctrl + A', no: 'Velg alle viste', en: 'Select all shown' },
  { id: 'clear', keys: 'Esc', no: 'Lukk eller tøm utvalg', en: 'Close or clear selection' },
  { id: 'approve', keys: 'A', no: 'Godkjenn', en: 'Approve' },
  { id: 'needsChanges', keys: 'N', no: 'Be om endringer', en: 'Request changes' },
  { id: 'reject', keys: 'X', no: 'Avvis', en: 'Reject' },
  { id: 'flag', keys: 'P', no: 'Flagg', en: 'Flag' },
  { id: 'rate0', keys: '0', no: 'Fjern vurdering', en: 'Clear rating' },
  { id: 'rate1', keys: '1', no: 'Gi 1 stjerne', en: 'Rate 1 star' },
  { id: 'rate2', keys: '2', no: 'Gi 2 stjerner', en: 'Rate 2 stars' },
  { id: 'rate3', keys: '3', no: 'Gi 3 stjerner', en: 'Rate 3 stars' },
  { id: 'rate4', keys: '4', no: 'Gi 4 stjerner', en: 'Rate 4 stars' },
  { id: 'rate5', keys: '5', no: 'Gi 5 stjerner', en: 'Rate 5 stars' },
  { id: 'submit', keys: '⌘/Ctrl + Enter', no: 'Send kommentar', en: 'Submit comment' },
  { id: 'commands', keys: '⌘/Ctrl + K', no: 'Åpne kommandoer', en: 'Open commands' },
  { id: 'help', keys: '?', no: 'Vis hurtigtaster', en: 'Show shortcuts' },
];

export function isEditableShortcutTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  if (['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)) return true;
  if (target.isContentEditable) return true;
  return Boolean(target.closest('[contenteditable="true"], [role="textbox"], [role="combobox"]'));
}

export function resolveMediaRoomShortcut(event: KeyboardEvent): MediaRoomShortcutId | null {
  const key = event.key.toLowerCase();
  const command = event.metaKey || event.ctrlKey;
  if (command && key === 'k') return 'commands';
  if (command && key === 'enter') return 'submit';
  if (command && key === 'a') return 'selectAll';
  if (event.altKey || command) return null;
  if (event.key === '?' || (event.shiftKey && event.key === '/')) return 'help';
  if (event.key === 'Escape') return 'clear';
  if (event.key === 'ArrowLeft') return event.shiftKey ? 'extendPrevious' : 'previous';
  if (event.key === 'ArrowRight') return event.shiftKey ? 'extendNext' : 'next';
  if (event.shiftKey) return null;
  if (key >= '0' && key <= '5') return `rate${key}` as MediaRoomShortcutId;
  const direct: Partial<Record<string, MediaRoomShortcutId>> = {
    g: 'grid', e: 'review', enter: 'review', c: 'compare', f: 'fullscreen',
    '/': 'search', a: 'approve', n: 'needsChanges', x: 'reject', p: 'flag',
  };
  return direct[key] || null;
}
