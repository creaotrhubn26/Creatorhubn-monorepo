/**
 * ElementTargetingService - Click to Highlight UI Elements
 * 
 * Features:
 * - Click to highlight specific UI element
 * - DOM path capture for bug reports
 * - Highlight mode with overlay
 * - Element inspector
 */

// ============================================================================
// Types
// ============================================================================

export interface TargetedElement {
  selector: string;
  xpath: string;
  tagName: string;
  id: string | null;
  className: string;
  textContent: string;
  rect: DOMRect;
  computedStyle: {
    color: string;
    backgroundColor: string;
    fontSize: string;
    fontFamily: string;
  };
  attributes: Record<string, string>;
  parentChain: string[];
}

export interface HighlightOptions {
  color?: string;
  borderWidth?: number;
  labelPosition?: 'top' | 'bottom' | 'left' | 'right';
  showLabel?: boolean;
  showTooltip?: boolean;
}

// ============================================================================
// ElementTargetingService
// ============================================================================

class ElementTargetingService {
  private overlay: HTMLDivElement | null = null;
  private label: HTMLDivElement | null = null;
  private tooltip: HTMLDivElement | null = null;
  private isActive = false;
  private onSelectCallback: ((element: TargetedElement) => void) | null = null;
  private currentTarget: HTMLElement | null = null;

  // --------------------------------------------------------------------------
  // Highlight Mode
  // --------------------------------------------------------------------------

  startHighlightMode(
    onSelect: (element: TargetedElement) => void,
    options?: HighlightOptions
  ): void {
    if (this.isActive) return;
    this.isActive = true;
    this.onSelectCallback = onSelect;

    // Create overlay
    this.overlay = document.createElement('div');
    this.overlay.className = 'element-targeting-overlay';
    this.overlay.style.cssText = `
      position: fixed;
      pointer-events: none;
      border: 2px solid ${options?.color || '#2196f3'};
      background: ${options?.color || '#2196f3'}20;
      border-radius: 4px;
      transition: all 0.1s ease;
      z-index: 99998;
      display: none;
    `;
    document.body.appendChild(this.overlay);

    // Create label
    if (options?.showLabel !== false) {
      this.label = document.createElement('div');
      this.label.className = 'element-targeting-label';
      this.label.style.cssText = `
        position: fixed;
        background: ${options?.color || '#2196f3'};
        color: white;
        padding: 4px 8px;
        border-radius: 4px;
        font-size: 12px;
        font-family: monospace;
        pointer-events: none;
        z-index: 99999;
        display: none;
        white-space: nowrap;
      `;
      document.body.appendChild(this.label);
    }

    // Create tooltip
    if (options?.showTooltip !== false) {
      this.tooltip = document.createElement('div');
      this.tooltip.className = 'element-targeting-tooltip';
      this.tooltip.style.cssText = `
        position: fixed;
        background: #1a1a1a;
        color: white;
        padding: 12px;
        border-radius: 8px;
        font-size: 12px;
        pointer-events: none;
        z-index: 99999;
        display: none;
        max-width: 300px;
        box-shadow: 0 4px 20px rgba(0,0,0,0.3);
      `;
      document.body.appendChild(this.tooltip);
    }

    // Add cursor style
    document.body.style.cursor = 'crosshair';

    // Add event listeners
    document.addEventListener('mousemove', this.handleMouseMove);
    document.addEventListener('click', this.handleClick, true);
    document.addEventListener('keydown', this.handleKeyDown);
  }

  stopHighlightMode(): void {
    if (!this.isActive) return;
    this.isActive = false;
    this.onSelectCallback = null;

    // Remove overlay
    this.overlay?.remove();
    this.overlay = null;

    // Remove label
    this.label?.remove();
    this.label = null;

    // Remove tooltip
    this.tooltip?.remove();
    this.tooltip = null;

    // Reset cursor
    document.body.style.cursor = ', ';

    // Remove event listeners
    document.removeEventListener('mousemove', this.handleMouseMove);
    document.removeEventListener('click', this.handleClick, true);
    document.removeEventListener('keydown', this.handleKeyDown);
  }

  private handleMouseMove = (event: MouseEvent): void => {
    const target = event.target as HTMLElement;
    
    // Ignore our own elements
    if (
      target === this.overlay ||
      target === this.label ||
      target === this.tooltip ||
      target.closest('.prototype-feedback-tool') ||
      target.closest('.element-targeting-overlay')
    ) {
      return;
    }

    this.currentTarget = target;
    const rect = target.getBoundingClientRect();

    // Update overlay
    if (this.overlay) {
      this.overlay.style.display = 'block';
      this.overlay.style.top = `${rect.top}px`;
      this.overlay.style.left = `${rect.left}px`;
      this.overlay.style.width = `${rect.width}px`;
      this.overlay.style.height = `${rect.height}px`;
    }

    // Update label
    if (this.label) {
      this.label.style.display = 'block';
      this.label.textContent = this.getElementLabel(target);
      this.label.style.top = `${rect.top - 24}px`;
      this.label.style.left = `${rect.left}px`;
    }

    // Update tooltip
    if (this.tooltip) {
      this.tooltip.style.display = 'block';
      this.tooltip.innerHTML = this.getTooltipContent(target);
      
      // Position tooltip
      const tooltipRect = this.tooltip.getBoundingClientRect();
      let tooltipTop = event.clientY + 20;
      let tooltipLeft = event.clientX + 20;

      // Adjust if going off screen
      if (tooltipTop + tooltipRect.height > window.innerHeight) {
        tooltipTop = event.clientY - tooltipRect.height - 10;
      }
      if (tooltipLeft + tooltipRect.width > window.innerWidth) {
        tooltipLeft = event.clientX - tooltipRect.width - 10;
      }

      this.tooltip.style.top = `${tooltipTop}px`;
      this.tooltip.style.left = `${tooltipLeft}px`;
    }
  };

  private handleClick = (event: MouseEvent): void => {
    const target = event.target as HTMLElement;
    
    // Ignore our own elements
    if (
      target === this.overlay ||
      target === this.label ||
      target === this.tooltip ||
      target.closest('.prototype-feedback-tool')
    ) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();

    const elementInfo = this.getElementInfo(target);
    this.onSelectCallback?.(elementInfo);
    this.stopHighlightMode();
  };

  private handleKeyDown = (event: KeyboardEvent): void => {
    if (event.key === 'Escape') {
      this.stopHighlightMode();
    }
  };

  // --------------------------------------------------------------------------
  // Element Info
  // --------------------------------------------------------------------------

  getElementInfo(element: HTMLElement): TargetedElement {
    const rect = element.getBoundingClientRect();
    const style = window.getComputedStyle(element);

    // Get attributes
    const attributes: Record<string, string> = {};
    for (const attr of element.attributes) {
      attributes[attr.name] = attr.value;
    }

    // Get parent chain
    const parentChain: string[] = [];
    let parent = element.parentElement;
    while (parent && parent !== document.body) {
      parentChain.push(this.getElementLabel(parent));
      parent = parent.parentElement;
    }

    return {
      selector: this.getSelector(element),
      xpath: this.getXPath(element),
      tagName: element.tagName.toLowerCase(),
      id: element.id || null,
      className: element.className,
      textContent: element.textContent?.slice(0, 100) || ', ',
      rect,
      computedStyle: {
        color: style.color,
        backgroundColor: style.backgroundColor,
        fontSize: style.fontSize,
        fontFamily: style.fontFamily,
      },
      attributes,
      parentChain,
    };
  }

  private getElementLabel(element: HTMLElement): string {
    let label = element.tagName.toLowerCase();
    if (element.id) {
      label += `#${element.id}`;
    } else if (element.className) {
      const classes = element.className.split(' ').filter(Boolean).slice(0, 2);
      if (classes.length > 0) {
        label += `.${classes.join('.')}`;
      }
    }
    return label;
  }

  private getSelector(element: HTMLElement): string {
    if (element.id) {
      return `#${element.id}`;
    }

    const path: string[] = [];
    let current: HTMLElement | null = element;

    while (current && current !== document.body) {
      let selector = current.tagName.toLowerCase();
      
      if (current.id) {
        selector = `#${current.id}`;
        path.unshift(selector);
        break;
      }

      if (current.className) {
        const classes = current.className.split(' ').filter(Boolean);
        if (classes.length > 0) {
          selector += `.${classes[0]}`;
        }
      }

      // Add nth-child if needed for uniqueness
      const parent = current.parentElement;
      if (parent) {
        const siblings = Array.from(parent.children).filter(
          c => c.tagName === current!.tagName
        );
        if (siblings.length > 1) {
          const index = siblings.indexOf(current) + 1;
          selector += `:nth-child(${index})`;
        }
      }

      path.unshift(selector);
      current = current.parentElement;
    }

    return path.join(' > ');
  }

  private getXPath(element: HTMLElement): string {
    const parts: string[] = [];
    let current: HTMLElement | null = element;

    while (current && current !== document.body) {
      let part = current.tagName.toLowerCase();
      
      if (current.id) {
        part = `//*[@id="${current.id}"]`;
        parts.unshift(part);
        break;
      }

      // Add position
      const parent = current.parentElement;
      if (parent) {
        const siblings = Array.from(parent.children).filter(
          c => c.tagName === current!.tagName
        );
        if (siblings.length > 1) {
          const index = siblings.indexOf(current) + 1;
          part += `[${index}]`;
        }
      }

      parts.unshift(part);
      current = current.parentElement;
    }

    return '//' + parts.join('/');
  }

  private getTooltipContent(element: HTMLElement): string {
    const style = window.getComputedStyle(element);
    const rect = element.getBoundingClientRect();

    return `
      <div style="margin-bottom: 8px; font-weight: bold; color: #2196f3;">
        ${this.getElementLabel(element)}
      </div>
      <div style="display: grid; grid-template-columns: auto 1fr; gap: 4px 12px; font-family: monospace; font-size: 11px;">
        <span style="color: #888;">Size:</span>
        <span>${Math.round(rect.width)} x ${Math.round(rect.height)}</span>
        <span style="color: #888;">Position:</span>
        <span>${Math.round(rect.left)}, ${Math.round(rect.top)}</span>
        ${element.id ? `<span style="color: #888;">ID:</span><span>#${element.id}</span>` : ', '}
        ${element.className ? `<span style="color: #888;">Class:</span><span>.${element.className.split(', ')[0]}</span>` : ', '}
      </div>
      <div style="margin-top: 8px; padding-top: 8px; border-top: 1px solid #333; color: #888; font-size: 11px;">
        Click to select this element
      </div>
    `;
  }

  // --------------------------------------------------------------------------
  // Static Highlight
  // --------------------------------------------------------------------------

  highlightElement(
    element: HTMLElement,
    options?: HighlightOptions
  ): () => void {
    const rect = element.getBoundingClientRect();
    const color = options?.color ||'#f44336';

    const highlight = document.createElement('div');
    highlight.style.cssText = `
      position: fixed;
      top: ${rect.top - (options?.borderWidth || 2)}px;
      left: ${rect.left - (options?.borderWidth || 2)}px;
      width: ${rect.width + (options?.borderWidth || 2) * 2}px;
      height: ${rect.height + (options?.borderWidth || 2) * 2}px;
      border: ${options?.borderWidth || 2}px solid ${color};
      border-radius: 4px;
      pointer-events: none;
      z-index: 99998;
      animation: pulse 1.5s infinite;
    `;

    // Add pulse animation
    const style = document.createElement('style');
    style.textContent = `
      @keyframes pulse {
        0%, 100% { opacity: 1; }
        50% { opacity: 0.5; }
      }
    `;
    document.head.appendChild(style);
    document.body.appendChild(highlight);

    // Return cleanup function
    return () => {
      highlight.remove();
      style.remove();
    };
  }

  // --------------------------------------------------------------------------
  // Element Comparison
  // --------------------------------------------------------------------------

  compareElements(
    el1: TargetedElement,
    el2: TargetedElement
  ): {
    sameElement: boolean;
    differences: string[];
  } {
    const differences: string[] = [];

    if (el1.selector !== el2.selector) {
      differences.push(`Selector: "${el1.selector}" vs"${el2.selector}"`);
    }
    if (el1.textContent !== el2.textContent) {
      differences.push('Text content changed');
    }
    if (el1.computedStyle.color !== el2.computedStyle.color) {
      differences.push(`Color: ${el1.computedStyle.color} vs ${el2.computedStyle.color}`);
    }
    if (el1.computedStyle.backgroundColor !== el2.computedStyle.backgroundColor) {
      differences.push(`Background: ${el1.computedStyle.backgroundColor} vs ${el2.computedStyle.backgroundColor}`);
    }

    return {
      sameElement: el1.selector === el2.selector,
      differences,
    };
  }
}

// ============================================================================
// Export
// ============================================================================

export const elementTargetingService = new ElementTargetingService();
export default elementTargetingService;

