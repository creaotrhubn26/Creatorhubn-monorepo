export type ScreenplayElement =
  | 'scene_heading'
  | 'action'
  | 'character'
  | 'dialogue'
  | 'parenthetical'
  | 'transition'
  | 'shot'
  | 'centered'
  | 'title_page'
  | 'section'
  | 'synopsis'
  | 'note'
  | 'boneyard'
  | 'page_break'
  | 'dual_dialogue';

export type KeyboardScreenplayElement =
  | 'scene_heading'
  | 'action'
  | 'character'
  | 'parenthetical'
  | 'dialogue'
  | 'transition'
  | 'shot'
  | 'note';

export type ScreenplayShortcutId =
  | 'general'
  | KeyboardScreenplayElement
  | 'dual_dialogue';

export type ScreenplayPlatform = 'mac' | 'windows';
export type ScreenplayModifier = 'primary' | 'control' | 'shift' | 'alt';

export interface ScreenplayShortcutBinding {
  code: string;
  keyLabel: string;
  modifiers: ScreenplayModifier[];
  platform?: ScreenplayPlatform;
}

export interface ScreenplayShortcutCommand {
  id: ScreenplayShortcutId;
  label: string;
  element: ScreenplayElement;
  bindings: readonly ScreenplayShortcutBinding[];
}

export interface ScreenplayElementRule {
  type: ScreenplayElement;
  label: string;
  accessibilityLabel: string;
  description: string;
  menuMnemonic?: string;
  showInMenu: boolean;
  blankTemplate: string;
  blankCursorOffset?: number;
  nextOnEnter: ScreenplayElement;
  nextOnTab: ScreenplayElement;
  previousOnTab: ScreenplayElement;
}

export type ScreenplayShortcutOverrides = Partial<
  Record<ScreenplayShortcutId, ScreenplayShortcutBinding>
>;

export interface ScreenplayKeyboardEventLike {
  code: string;
  key: string;
  ctrlKey: boolean;
  metaKey: boolean;
  shiftKey: boolean;
  altKey: boolean;
}

const primaryNumber = (digit: string): ScreenplayShortcutBinding => ({
  code: `Digit${digit}`,
  keyLabel: digit,
  modifiers: ['primary'],
});

export const SCREENPLAY_SHORTCUT_COMMANDS: readonly ScreenplayShortcutCommand[] = [
  { id: 'general', label: 'General', element: 'action', bindings: [primaryNumber('0')] },
  { id: 'scene_heading', label: 'Scene Heading', element: 'scene_heading', bindings: [primaryNumber('1')] },
  { id: 'action', label: 'Action', element: 'action', bindings: [primaryNumber('2')] },
  { id: 'character', label: 'Character', element: 'character', bindings: [primaryNumber('3')] },
  { id: 'parenthetical', label: 'Parenthetical', element: 'parenthetical', bindings: [primaryNumber('4')] },
  { id: 'dialogue', label: 'Dialogue', element: 'dialogue', bindings: [primaryNumber('5')] },
  { id: 'transition', label: 'Transition', element: 'transition', bindings: [primaryNumber('6')] },
  { id: 'shot', label: 'Shot', element: 'shot', bindings: [primaryNumber('7')] },
  {
    id: 'note',
    label: 'Note',
    element: 'note',
    bindings: [
      { code: 'Digit4', keyLabel: '4', modifiers: ['primary', 'control'], platform: 'mac' },
      { code: 'Digit4', keyLabel: '4', modifiers: ['primary', 'shift'], platform: 'windows' },
    ],
  },
  {
    id: 'dual_dialogue',
    label: 'Dual Dialogue',
    element: 'dual_dialogue',
    bindings: [
      { code: 'KeyD', keyLabel: 'D', modifiers: ['primary'], platform: 'mac' },
      { code: 'KeyD', keyLabel: 'D', modifiers: ['primary', 'alt'], platform: 'windows' },
    ],
  },
];

const SCREENPLAY_MODIFIERS = new Set<ScreenplayModifier>([
  'primary',
  'control',
  'shift',
  'alt',
]);

export function sanitizeScreenplayShortcutOverrides(
  value: unknown,
): ScreenplayShortcutOverrides {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  const record = value as Record<string, unknown>;
  const sanitized: ScreenplayShortcutOverrides = {};

  SCREENPLAY_SHORTCUT_COMMANDS.forEach((command) => {
    const candidate = record[command.id];
    if (!candidate || typeof candidate !== 'object' || Array.isArray(candidate)) return;
    const binding = candidate as Partial<ScreenplayShortcutBinding>;
    if (typeof binding.code !== 'string' || !binding.code.trim()) return;
    if (typeof binding.keyLabel !== 'string' || !binding.keyLabel.trim()) return;
    if (!Array.isArray(binding.modifiers) || binding.modifiers.length === 0) return;
    const modifiers = binding.modifiers.filter(
      (modifier): modifier is ScreenplayModifier =>
        typeof modifier === 'string' && SCREENPLAY_MODIFIERS.has(modifier as ScreenplayModifier),
    );
    if (modifiers.length !== binding.modifiers.length) return;
    sanitized[command.id] = {
      code: binding.code,
      keyLabel: binding.keyLabel,
      modifiers: Array.from(new Set(modifiers)),
    };
  });

  return sanitized;
}

export const SCREENPLAY_ELEMENT_RULES: Readonly<Record<ScreenplayElement, ScreenplayElementRule>> = {
  scene_heading: {
    type: 'scene_heading', label: 'Scene Heading', accessibilityLabel: 'scene heading',
    description: 'INT./EXT. LOCATION - TIME', menuMnemonic: 's', showInMenu: true,
    blankTemplate: 'INT. ', nextOnEnter: 'action', nextOnTab: 'action', previousOnTab: 'transition',
  },
  action: {
    type: 'action', label: 'Action', accessibilityLabel: 'action',
    description: 'Scene description', menuMnemonic: 'a', showInMenu: true,
    blankTemplate: '', nextOnEnter: 'action', nextOnTab: 'character', previousOnTab: 'dialogue',
  },
  character: {
    type: 'character', label: 'Character', accessibilityLabel: 'character',
    description: 'CHARACTER NAME', menuMnemonic: 'c', showInMenu: true,
    blankTemplate: '', nextOnEnter: 'dialogue', nextOnTab: 'parenthetical', previousOnTab: 'action',
  },
  parenthetical: {
    type: 'parenthetical', label: 'Parenthetical', accessibilityLabel: 'parenthetical',
    description: '(beat), (whispering)', menuMnemonic: 'p', showInMenu: true,
    blankTemplate: '()', blankCursorOffset: 1,
    nextOnEnter: 'dialogue', nextOnTab: 'dialogue', previousOnTab: 'character',
  },
  dialogue: {
    type: 'dialogue', label: 'Dialogue', accessibilityLabel: 'dialogue',
    description: "Character's spoken lines", menuMnemonic: 'd', showInMenu: true,
    blankTemplate: '', nextOnEnter: 'action', nextOnTab: 'character', previousOnTab: 'parenthetical',
  },
  transition: {
    type: 'transition', label: 'Transition', accessibilityLabel: 'transition',
    description: 'CUT TO:, FADE OUT', menuMnemonic: 't', showInMenu: true,
    blankTemplate: '', nextOnEnter: 'scene_heading', nextOnTab: 'scene_heading', previousOnTab: 'dialogue',
  },
  shot: {
    type: 'shot', label: 'Shot', accessibilityLabel: 'shot',
    description: 'SHOT: / ANGLE ON:', menuMnemonic: 'h', showInMenu: true,
    blankTemplate: 'SHOT: ', nextOnEnter: 'action', nextOnTab: 'action', previousOnTab: 'transition',
  },
  centered: {
    type: 'centered', label: 'Centered', accessibilityLabel: 'centered text',
    description: '>TEXT<', menuMnemonic: 'c', showInMenu: true,
    blankTemplate: '><', blankCursorOffset: 1,
    nextOnEnter: 'action', nextOnTab: 'action', previousOnTab: 'dialogue',
  },
  title_page: {
    type: 'title_page', label: 'Title Page', accessibilityLabel: 'title page',
    description: 'Title page field', showInMenu: false, blankTemplate: '',
    nextOnEnter: 'action', nextOnTab: 'action', previousOnTab: 'action',
  },
  section: {
    type: 'section', label: 'Section', accessibilityLabel: 'section',
    description: '# ACT ONE', menuMnemonic: 's', showInMenu: true,
    blankTemplate: '# ', nextOnEnter: 'action', nextOnTab: 'action', previousOnTab: 'dialogue',
  },
  synopsis: {
    type: 'synopsis', label: 'Synopsis', accessibilityLabel: 'synopsis',
    description: '= Synopsis', showInMenu: false, blankTemplate: '= ',
    nextOnEnter: 'synopsis', nextOnTab: 'action', previousOnTab: 'section',
  },
  note: {
    type: 'note', label: 'Note', accessibilityLabel: 'script note',
    description: '[[Note text]]', menuMnemonic: 'n', showInMenu: true,
    blankTemplate: '[[]]', blankCursorOffset: 2,
    nextOnEnter: 'action', nextOnTab: 'note', previousOnTab: 'action',
  },
  boneyard: {
    type: 'boneyard', label: 'Boneyard', accessibilityLabel: 'boneyard comment',
    description: '/* Hidden text */', showInMenu: false, blankTemplate: '/**/', blankCursorOffset: 2,
    nextOnEnter: 'action', nextOnTab: 'action', previousOnTab: 'action',
  },
  page_break: {
    type: 'page_break', label: 'Page Break', accessibilityLabel: 'page break',
    description: '===', menuMnemonic: 'b', showInMenu: true,
    blankTemplate: '===', nextOnEnter: 'action', nextOnTab: 'action', previousOnTab: 'action',
  },
  dual_dialogue: {
    type: 'dual_dialogue', label: 'Dual Dialogue', accessibilityLabel: 'dual dialogue',
    description: 'Mark character cue for dual dialogue', menuMnemonic: 'u', showInMenu: true,
    blankTemplate: '', nextOnEnter: 'dialogue', nextOnTab: 'parenthetical', previousOnTab: 'character',
  },
};

export const SCREENPLAY_MENU_RULES = Object.values(SCREENPLAY_ELEMENT_RULES)
  .filter((rule) => rule.showInMenu);

export const SCREENPLAY_ELEMENT_SHORTCUTS: ReadonlyArray<{
  key: string;
  type: ScreenplayElement;
}> = SCREENPLAY_SHORTCUT_COMMANDS
  .filter((command) => [
    'general',
    'scene_heading',
    'action',
    'character',
    'parenthetical',
    'dialogue',
    'transition',
    'shot',
  ].includes(command.id))
  .map((command) => ({
    key: command.bindings[0].keyLabel,
    type: command.element,
  }));

export function detectScreenplayPlatform(
  platformValue = typeof navigator === 'undefined' ? '' : navigator.platform,
): ScreenplayPlatform {
  return /mac|iphone|ipad|ipod/i.test(platformValue) ? 'mac' : 'windows';
}

const bindingForCommand = (
  command: ScreenplayShortcutCommand,
  platform: ScreenplayPlatform,
  overrides: ScreenplayShortcutOverrides,
): ScreenplayShortcutBinding | null => {
  const override = overrides[command.id];
  if (override) return override;
  return command.bindings.find((binding) => !binding.platform || binding.platform === platform) ?? null;
};

export function getScreenplayShortcutBinding(
  shortcutId: ScreenplayShortcutId,
  platform = detectScreenplayPlatform(),
  overrides: ScreenplayShortcutOverrides = {},
): ScreenplayShortcutBinding | null {
  const command = SCREENPLAY_SHORTCUT_COMMANDS.find((entry) => entry.id === shortcutId);
  return command ? bindingForCommand(command, platform, overrides) : null;
}

const modifierStateForBinding = (
  binding: ScreenplayShortcutBinding,
  platform: ScreenplayPlatform,
) => ({
  metaKey: binding.modifiers.includes('primary') && platform === 'mac',
  ctrlKey:
    binding.modifiers.includes('control') ||
    (binding.modifiers.includes('primary') && platform === 'windows'),
  shiftKey: binding.modifiers.includes('shift'),
  altKey: binding.modifiers.includes('alt'),
});

export function matchesScreenplayBinding(
  event: ScreenplayKeyboardEventLike,
  binding: ScreenplayShortcutBinding,
  platform: ScreenplayPlatform,
): boolean {
  if (event.code !== binding.code) return false;
  const expected = modifierStateForBinding(binding, platform);
  return event.metaKey === expected.metaKey
    && event.ctrlKey === expected.ctrlKey
    && event.shiftKey === expected.shiftKey
    && event.altKey === expected.altKey;
}

export function screenplayShortcutFromEvent(
  event: ScreenplayKeyboardEventLike,
  overrides: ScreenplayShortcutOverrides = {},
  platform = detectScreenplayPlatform(),
): ScreenplayShortcutCommand | null {
  return SCREENPLAY_SHORTCUT_COMMANDS.find((command) => {
    const binding = bindingForCommand(command, platform, overrides);
    return binding ? matchesScreenplayBinding(event, binding, platform) : false;
  }) ?? null;
}

export function screenplayElementFromShortcutKey(key: string): ScreenplayElement | null {
  return SCREENPLAY_ELEMENT_SHORTCUTS.find((shortcut) => shortcut.key === key)?.type ?? null;
}

export function formatScreenplayShortcut(
  binding: ScreenplayShortcutBinding,
  platform = detectScreenplayPlatform(),
): string {
  const parts: string[] = [];
  if (binding.modifiers.includes('primary')) parts.push(platform === 'mac' ? '⌘' : 'Ctrl');
  if (binding.modifiers.includes('control')) parts.push(platform === 'mac' ? '⌃' : 'Ctrl');
  if (binding.modifiers.includes('alt')) parts.push(platform === 'mac' ? '⌥' : 'Alt');
  if (binding.modifiers.includes('shift')) parts.push(platform === 'mac' ? '⇧' : 'Shift');
  if (platform === 'mac') return `${parts.join('')}${binding.keyLabel}`;
  return [...parts, binding.keyLabel].join('+');
}

export function screenplayShortcutLabel(
  shortcutId: ScreenplayShortcutId,
  platform = detectScreenplayPlatform(),
  overrides: ScreenplayShortcutOverrides = {},
): string {
  const command = SCREENPLAY_SHORTCUT_COMMANDS.find((entry) => entry.id === shortcutId);
  const binding = command ? getScreenplayShortcutBinding(command.id, platform, overrides) : null;
  return binding ? formatScreenplayShortcut(binding, platform) : '';
}

export function screenplayElementShortcutLabel(
  type: KeyboardScreenplayElement,
  platform = detectScreenplayPlatform(),
  overrides: ScreenplayShortcutOverrides = {},
): string {
  return screenplayShortcutLabel(type, platform, overrides);
}

export function getScreenplayElementRule(type: ScreenplayElement): ScreenplayElementRule {
  return SCREENPLAY_ELEMENT_RULES[type];
}

export function getNextScreenplayElement(
  type: ScreenplayElement,
  trigger: 'enter' | 'tab',
  reverse = false,
): ScreenplayElement {
  const rule = getScreenplayElementRule(type);
  if (trigger === 'enter') return rule.nextOnEnter;
  return reverse ? rule.previousOnTab : rule.nextOnTab;
}

export function getScreenplayParagraphSeparator(
  from: ScreenplayElement,
  to: ScreenplayElement,
): '\n' | '\n\n' {
  const compactTransition =
    (from === 'character' && (to === 'dialogue' || to === 'parenthetical'))
    || (from === 'parenthetical' && to === 'dialogue')
    || (from === 'action' && to === 'action')
    || (from === 'note' && to === 'note');
  return compactTransition ? '\n' : '\n\n';
}

const stripElementSyntax = (raw: string): string => raw
  .replace(/^@/, '')
  .replace(/^\.(?=\S)/, '')
  .replace(/^>(?!.*<$)/, '')
  .replace(/^SHOT:\s*/i, '')
  .replace(/\s*\^\s*$/, '')
  .replace(/^\[\[|\]\]$/g, '')
  .replace(/^#+\s*/, '')
  .replace(/^=\s*/, '')
  .replace(/^\(|\)$/g, '')
  .trim();

export function formatLineAsScreenplayElement(
  raw: string,
  to: ScreenplayElement,
): { text: string; cursorOffset: number } {
  const rule = getScreenplayElementRule(to);
  if (!raw.trim()) {
    return {
      text: rule.blankTemplate,
      cursorOffset: rule.blankCursorOffset ?? rule.blankTemplate.length,
    };
  }

  const content = stripElementSyntax(raw);
  let text: string;
  switch (to) {
    case 'character':
      text = content.toUpperCase();
      break;
    case 'parenthetical':
      text = `(${content.toLowerCase()})`;
      break;
    case 'dialogue':
    case 'action':
      text = content;
      break;
    case 'scene_heading': {
      const existingHeading = raw.trim().replace(/^\./, '');
      text = /^(?:INT|EXT|EST|INT\.?\/EXT|I\/E)\.?[\s.]/i.test(existingHeading)
        ? existingHeading.toUpperCase()
        : `INT. ${content.toUpperCase()} - DAY`;
      break;
    }
    case 'transition':
      text = `${content.toUpperCase().replace(/[:.]$/, '')}:`;
      break;
    case 'shot':
      text = /^SHOT:/i.test(raw.trim())
        ? raw.trim().toUpperCase()
        : `SHOT: ${content.toUpperCase()}`;
      break;
    case 'section':
      text = `# ${content}`;
      break;
    case 'synopsis':
      text = `= ${content}`;
      break;
    case 'centered':
      text = `>${content}<`;
      break;
    case 'note':
      text = `[[${content}]]`;
      break;
    case 'page_break':
      text = '===';
      break;
    case 'boneyard':
      text = `/*${content}*/`;
      break;
    case 'dual_dialogue':
      text = `${content.toUpperCase()} ^`;
      break;
    default:
      text = content;
  }
  return { text, cursorOffset: text.length };
}

const bindingSignature = (
  binding: ScreenplayShortcutBinding,
  platform: ScreenplayPlatform,
): string => {
  const state = modifierStateForBinding(binding, platform);
  return [binding.code, state.metaKey, state.ctrlKey, state.shiftKey, state.altKey].join(':');
};

export const SCREENPLAY_RESERVED_SHORTCUTS: ReadonlyArray<{
  owner: string;
  binding: ScreenplayShortcutBinding;
}> = [
  {
    owner: 'Grammar suggestions',
    binding: { code: 'Tab', keyLabel: 'Tab', modifiers: ['primary'] },
  },
  {
    owner: 'Story Logic',
    binding: { code: 'Enter', keyLabel: 'Enter', modifiers: ['primary'] },
  },
];

export function findScreenplayShortcutConflicts(
  overrides: ScreenplayShortcutOverrides,
  platform = detectScreenplayPlatform(),
): string[] {
  const ownersBySignature = new Map<string, string[]>();
  const addOwner = (signature: string, owner: string) => {
    ownersBySignature.set(signature, [...(ownersBySignature.get(signature) ?? []), owner]);
  };

  SCREENPLAY_SHORTCUT_COMMANDS.forEach((command) => {
    const binding = bindingForCommand(command, platform, overrides);
    if (binding) addOwner(bindingSignature(binding, platform), command.label);
  });
  SCREENPLAY_RESERVED_SHORTCUTS.forEach(({ owner, binding }) => {
    addOwner(bindingSignature(binding, platform), owner);
  });

  return Array.from(ownersBySignature.values())
    .filter((owners) => owners.length > 1)
    .map((owners) => owners.join(' / '));
}
