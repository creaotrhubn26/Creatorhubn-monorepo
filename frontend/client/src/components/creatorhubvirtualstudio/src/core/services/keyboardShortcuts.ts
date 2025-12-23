/**
 * Keyboard Shortcuts Service
 * 
 * Global keyboard shortcut handler for Virtual Studio
 */

export type ShortcutAction = 
  | 'play-pause'
  | 'save'
  | 'undo'
  | 'redo'
  | 'delete'
  | 'deselect'
  | 'toggle-grid'
  | 'toggle-helpers'
  | 'copy'
  | 'paste'
  | 'duplicate'
  | 'select-all'
  | 'focus-search'
  | 'toggle-fullscreen';

export interface Shortcut {
  key: string;
  ctrl?: boolean;
  shift?: boolean;
  alt?: boolean;
  meta?: boolean;
  action: ShortcutAction;
  description: string;
}

export type ShortcutHandler = (action: ShortcutAction) => void;

class KeyboardShortcutsService {
  private shortcuts: Map<string, Shortcut> = new Map();
  private handlers: Map<ShortcutAction, ShortcutHandler[]> = new Map();
  private isEnabled: boolean = true;

  constructor() {
    this.initializeDefaultShortcuts();
    this.setupEventListeners();
  }

  private initializeDefaultShortcuts(): void {
    const defaultShortcuts: Shortcut[] = [
      { key: ' ', action: 'play-pause', description: 'Play/Pause' },
      { key: 's', ctrl: true, action: 'save', description: 'Save' },
      { key: 'z', ctrl: true, action: 'undo', description: 'Undo' },
      { key: 'z', ctrl: true, shift: true, action: 'redo', description: 'Redo' },
      { key: 'Delete', action: 'delete', description: 'Delete selected' },
      { key: 'Backspace', action: 'delete', description: 'Delete selected' },
      { key: 'Escape', action: 'deselect', description: 'Deselect' },
      { key: 'g', action: 'toggle-grid', description: 'Toggle grid' },
      { key: 'h', action: 'toggle-helpers', description: 'Toggle helpers' },
      { key: 'c', ctrl: true, action: 'copy', description: 'Copy' },
      { key: 'v', ctrl: true, action: 'paste', description: 'Paste' },
      { key: 'd', ctrl: true, action: 'duplicate', description: 'Duplicate' },
      { key: 'a', ctrl: true, action: 'select-all', description: 'Select all' },
      { key: 'f', ctrl: true, action: 'focus-search', description: 'Focus search' },
      { key: 'F11', action: 'toggle-fullscreen', description: 'Toggle fullscreen' },
    ];

    defaultShortcuts.forEach((shortcut) => {
      const key = this.getShortcutKey(shortcut);
      this.shortcuts.set(key, shortcut);
    });
  }

  private getShortcutKey(shortcut: Shortcut): string {
    const parts: string[] = [];
    if (shortcut.ctrl || shortcut.meta) parts.push('ctrl');
    if (shortcut.shift) parts.push('shift');
    if (shortcut.alt) parts.push('alt');
    parts.push(shortcut.key.toLowerCase());
    return parts.join('+');
  }

  private setupEventListeners(): void {
    if (typeof window === 'undefined') return;

    window.addEventListener('keydown', (e) => {
      if (!this.isEnabled) return;

      // Don't trigger shortcuts when typing in inputs
      const target = e.target as HTMLElement;
      if (
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.isContentEditable
      ) {
        return;
      }

      const key = this.getKeyFromEvent(e);
      const shortcut = this.shortcuts.get(key);

      if (shortcut) {
        e.preventDefault();
        this.triggerAction(shortcut.action);
      }
    });
  }

  private getKeyFromEvent(e: KeyboardEvent): string {
    const parts: string[] = [];
    if (e.ctrlKey || e.metaKey) parts.push('ctrl');
    if (e.shiftKey) parts.push('shift');
    if (e.altKey) parts.push('alt');
    parts.push(e.key.toLowerCase());
    return parts.join('+');
  }

  /**
   * Register a handler for a shortcut action
   */
  public on(action: ShortcutAction, handler: ShortcutHandler): () => void {
    if (!this.handlers.has(action)) {
      this.handlers.set(action, []);
    }
    this.handlers.get(action)!.push(handler);

    // Return unsubscribe function
    return () => {
      const handlers = this.handlers.get(action);
      if (handlers) {
        const index = handlers.indexOf(handler);
        if (index > -1) {
          handlers.splice(index, 1);
        }
      }
    };
  }

  /**
   * Trigger a shortcut action
   */
  public triggerAction(action: ShortcutAction): void {
    const handlers = this.handlers.get(action);
    if (handlers) {
      handlers.forEach((handler) => handler(action));
    }
  }

  /**
   * Register a custom shortcut
   */
  public registerShortcut(shortcut: Shortcut): void {
    const key = this.getShortcutKey(shortcut);
    this.shortcuts.set(key, shortcut);
  }

  /**
   * Get all registered shortcuts
   */
  public getAllShortcuts(): Shortcut[] {
    return Array.from(this.shortcuts.values());
  }

  /**
   * Get shortcuts for a specific action
   */
  public getShortcutsForAction(action: ShortcutAction): Shortcut[] {
    return Array.from(this.shortcuts.values()).filter((s) => s.action === action);
  }

  /**
   * Enable/disable shortcuts
   */
  public setEnabled(enabled: boolean): void {
    this.isEnabled = enabled;
  }

  /**
   * Format shortcut for display
   */
  public formatShortcut(shortcut: Shortcut): string {
    const parts: string[] = [];
    if (shortcut.ctrl || shortcut.meta) parts.push('Ctrl');
    if (shortcut.shift) parts.push('Shift');
    if (shortcut.alt) parts.push('Alt');
    parts.push(shortcut.key.toUpperCase());
    return parts.join(' + ');
  }
}

export const keyboardShortcutsService = new KeyboardShortcutsService();
