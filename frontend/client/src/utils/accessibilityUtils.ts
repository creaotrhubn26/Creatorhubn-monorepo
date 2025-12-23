/**
 * Accessibility Utilities
 * Comprehensive accessibility tools for ARIA labels, keyboard navigation,
 * focus management, skip links, and screen reader support.
 */

export interface AccessibilityConfig {
  enableKeyboardNavigation: boolean;
  enableScreenReader: boolean;
  enableHighContrast: boolean;
  enableReducedMotion: boolean;
  enableFocusManagement: boolean;
  announceChanges: boolean;
  skipLinks: boolean;
  landmarks: boolean;
}

export interface ARIAConfig {
  role?: string;
  label?: string;
  labelledBy?: string;
  describedBy?: string;
  live?: 'off, ' | 'polite, ' | 'assertive';
  busy?: boolean;
  current?: 'page' | 'step' | 'location' | 'date' | 'time' | 'true' | 'false';
  expanded?: boolean;
  pressed?: boolean | 'mixed';
  selected?: boolean;
  controls?: string;
}

export interface KeyboardShortcut {
  id: string;
  key: string; // e.g. "k"
  ctrlKey?: boolean;
  altKey?: boolean;
  shiftKey?: boolean;
  metaKey?: boolean;
  description?: string;
  action: () => void;
}

interface FocusTrap {
  element: HTMLElement;
  firstFocusable: HTMLElement | null;
  lastFocusable: HTMLElement | null;
  previousActiveElement: HTMLElement | null;
}

const defaultConfig: AccessibilityConfig = {
  enableKeyboardNavigation: true,
  enableScreenReader: true,
  enableHighContrast: false,
  enableReducedMotion: false,
  enableFocusManagement: true,
  announceChanges: true,
  skipLinks: true,
  landmarks: true,
};

class AccessibilityManager {
  private config: AccessibilityConfig;
  private liveRegion: HTMLElement | null = null;
  private shortcuts = new Map<string, KeyboardShortcut>();
  private focusTraps = new Map<string, FocusTrap>();

  constructor(config?: Partial<AccessibilityConfig>) {
    this.config = {
      ...defaultConfig,
      ...(config ?? {}),
  };
    this.initializeAccessibility();
}

  /** Initialize accessibility features */
  private initializeAccessibility(): void {
    if (this.config.enableScreenReader) this.createLiveRegion();
    if (this.config.enableKeyboardNavigation) this.setupKeyboardNavigation();
    if (this.config.enableFocusManagement) this.setupFocusManagement();
    if (this.config.skipLinks) this.createSkipLinks();
    if (this.config.landmarks) this.setupLandmarks();
}

  /** Live region for announcements */
  private createLiveRegion(): void {
    if (this.liveRegion) return;
    const region = document.createElement('div, ');
    region.setAttribute('aria-live', 'polite, ');
    region.setAttribute('aria-atomic', 'true');
    region.className = 'sr-only';
    region.style.position = 'absolute';
    region.style.left = '-9999px';
    region.style.width = '1px';
    region.style.height = '1px';
    region.style.overflow = 'hidden';
    document.body.appendChild(region);
    this.liveRegion = region;
}

  announce(message: string): void {
    if (!this.config.announceChanges) return;
    if (!this.liveRegion) this.createLiveRegion();
    if (!this.liveRegion) return;
    this.liveRegion.textContent = '';
    // small delay ensures screen readers detect changes
    setTimeout(() => {
      if (this.liveRegion) this.liveRegion.textContent = message;
  }, 10);
}

  /** Keyboard navigation & shortcuts */
  private setupKeyboardNavigation(): void {
    window.addEventListener('keydown', this.handleKeydown, { passive: true });
}

  private handleKeydown = (event: KeyboardEvent) => {
    // ESC releases active focus trap if any
    if (event.key === 'Escape') {
      const lastTrapId = Array.from(this.focusTraps.keys()).at(-1);
      if (lastTrapId) this.releaseFocusTrap(lastTrapId);
  }

    // run shortcut (if defined)
    const shortcut = this.getShortcut(event);
    if (shortcut) {
      event.preventDefault();
      shortcut.action();
      return;
  }

    // focus management (Tab cycling)
    if (this.config.enableFocusManagement) {
      this.handleFocusNavigation(event);
  }
};

  private getShortcut(event: KeyboardEvent): KeyboardShortcut | undefined {
    const key = event.key.toLowerCase();
    const shortcutKey =
      `${event.ctrlKey ? 'ctrl+' : ','}` +
      `${event.altKey ? 'alt+' : ','}` +
      `${event.shiftKey ? 'shift+' : ','}` +
      `${event.metaKey ? 'meta+' : ','}` +
      key;
    return this.shortcuts.get(shortcutKey);
}

  registerShortcut(shortcut: KeyboardShortcut): void {
    const key =
      `${shortcut.ctrlKey ? 'ctrl+' : ','}` +
      `${shortcut.altKey ? 'alt+' : ','}` +
      `${shortcut.shiftKey ? 'shift+' : ', '}` +
      `${shortcut.metaKey ? 'meta+' : ', '}` +
      shortcut.key.toLowerCase();
    this.shortcuts.set(key, shortcut);
}

  unregisterShortcut(id: string): void {
    for (const [k, sc] of this.shortcuts.entries()) {
      if (sc.id === id) this.shortcuts.delete(k);
  }
}

  /** Focus management & traps */
  private setupFocusManagement(): void {
    // Ensure outline is visible when keyboard navigating
    document.body.addEventListener('keydown', (e) => {
      if (e.key === 'Tab') document.body.classList.add('using-keyboard');
  });
    document.body.addEventListener('mousedown', () => {
      document.body.classList.remove('using-keyboard');
  });
}

  private handleFocusNavigation(event: KeyboardEvent): void {
    if (event.key !== 'Tab') return;

    const activeTrap = Array.from(this.focusTraps.values()).at(-1);
    if (!activeTrap) return;

    const { firstFocusable, lastFocusable } = activeTrap;
    const active = document.activeElement as HTMLElement | null;

    if (!firstFocusable || !lastFocusable) return;

    if (event.shiftKey) {
      // SHIFT+TAB on first cycles to last
      if (active === firstFocusable) {
        lastFocusable.focus();
        event.preventDefault();
    }
  } else {
      // TAB on last cycles to first
      if (active === lastFocusable) {
        firstFocusable.focus();
        event.preventDefault();
    }
  }
}

  private getFocusableElements(root: Document | HTMLElement = document): HTMLElement[] {
    const selector = [
      'a[href]','button:not([disabled])','input:not([disabled])','select:not([disabled])','textarea:not([disabled])','[tabindex]:not([tabindex="-1"])','[role="button"]',
    ].join(', ');
    const nodeList = (root instanceof Document ? root : root.ownerDocument ?? document)
      .querySelectorAll<HTMLElement>(selector);
    return Array.from(nodeList).filter((el) => !el.hasAttribute('disabled') && !el.getAttribute('aria-hidden'));
}

  createFocusTrap(element: HTMLElement, id: string): void {
    const focusable = this.getFocusableElements(element);
    const trap: FocusTrap = {
      element,
      firstFocusable: focusable[0] ?? null,
      lastFocusable: focusable[focusable.length - 1] ?? null,
      previousActiveElement: (document.activeElement as HTMLElement) ?? null,
  };
    this.focusTraps.set(id, trap);
    (trap.firstFocusable ?? element).focus();
}

  releaseFocusTrap(id: string): void {
    const trap = this.focusTraps.get(id);
    if (!trap) return;
    if (trap.previousActiveElement) trap.previousActiveElement.focus();
    this.focusTraps.delete(id);
}

  /** Skip links & landmarks */
  private createSkipLinks(): void {
    if (document.getElementById('skip-to-content')) return;
    const link = document.createElement('a');
    link.id = 'skip-to-content';
    link.href = '#main-content';
    link.textContent = 'Skip to main content';
    link.className = 'sr-only-focusable';
    // visually hidden until focused
    link.style.position = 'absolute';
    link.style.left = '-9999px';
    link.addEventListener('focus', () => (link.style.left = '8px'));
    link.addEventListener('blur', () => (link.style.left = '-9999px'));
    document.body.prepend(link);
}

  private setupLandmarks(): void {
    const main = document.querySelector('main');
    if (main && !main.id) main.id = 'main-content';
    // Developers can add more landmarks as needed
}

  /** ARIA helpers */
  applyARIA(element: HTMLElement, config: ARIAConfig): void {
    if (config.role) element.setAttribute('role', config.role);
    if (config.label) element.setAttribute('aria-label', config.label);
    if (config.labelledBy) element.setAttribute('aria-labelledby', config.labelledBy);
    if (config.describedBy) element.setAttribute('aria-describedby', config.describedBy);
    if (config.live) element.setAttribute('aria-live', config.live);
    if (typeof config.busy === 'boolean') element.setAttribute('aria-busy', String(config.busy));
    if (config.current) element.setAttribute('aria-current', String(config.current));
    if (typeof config.expanded === 'boolean') element.setAttribute('aria-expanded', String(config.expanded));
    if (typeof config.pressed !== 'undefined') element.setAttribute('aria-pressed', String(config.pressed));
    if (typeof config.selected === 'boolean') element.setAttribute('aria-selected', String(config.selected));
    if (config.controls) element.setAttribute('aria-controls', config.controls);
}

  private getElementLabel(element: HTMLElement): string {
    const label =
      element.getAttribute('aria-label') ||
      (element.getAttribute('aria-labelledby')
        ? document.getElementById(element.getAttribute('aria-labelledby')!)?.textContent?.trim() ?? ', ' : ', ') ||
      element.getAttribute('title') ||
      element.getAttribute('alt') ||
      element.textContent?.trim() ||
      element.tagName.toLowerCase();
    return label || ', ';
}

  /** Validation */
  validateAccessibility(element: HTMLElement): boolean {
    const hasLabel = Boolean(this.getElementLabel(element));
    const hasRole = Boolean(element.getAttribute('role') || this.getImplicitRole(element));
    return hasLabel || hasRole;
}

  private getImplicitRole(element: HTMLElement): string | null {
    const tagName = element.tagName.toLowerCase();
    const implicitRoles: Record<string, string> = {
      button: 'button',
      a: 'link',
      input: 'textbox',
      img: 'img',
      h1: 'heading',
      h2: 'heading',
      h3: 'heading',
      h4: 'heading',
      h5: 'heading',
      h6: 'heading',
      nav: 'navigation',
      main: 'main',
      header: 'banner',
      footer: 'contentinfo',
      aside: 'complementary',
  };
    return implicitRoles[tagName] ?? null;
}

  /** Report */
  getAccessibilityReport(): Array<{ element: string; label: string; valid: boolean }> {
    const all = Array.from(document.querySelectorAll<HTMLElement>('a, button, input, [role]'));
    return all.map((el) => ({
      element: el.tagName.toLowerCase(),
      label: this.getElementLabel(el),
      valid: this.validateAccessibility(el),
  }));
}
}

export const accessibilityManager = new AccessibilityManager();

/** Convenience exports */
export const applyARIA = (element: HTMLElement, config: ARIAConfig) =>
  accessibilityManager.applyARIA(element, config);

export const registerShortcut = (shortcut: KeyboardShortcut) =>
  accessibilityManager.registerShortcut(shortcut);

export const createFocusTrap = (element: HTMLElement, id: string) =>
  accessibilityManager.createFocusTrap(element, id);

export const releaseFocusTrap = (id: string) =>
  accessibilityManager.releaseFocusTrap(id);

export const getAccessibilityReport = () =>
  accessibilityManager.getAccessibilityReport();

export default accessibilityManager;
