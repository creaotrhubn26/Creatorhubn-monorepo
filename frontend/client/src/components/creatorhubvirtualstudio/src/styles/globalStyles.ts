/**
 * Global Styles
 * 
 * Injects CSS custom properties and global styles
 * Should be imported in the root component
 */

import { generateCSSCustomProperties } from './designTokens';
import { colors } from './designTokens';

/**
 * Generate and inject CSS custom properties
 */
export function injectDesignTokens(): void {
  if (typeof document === 'undefined') return;
  
  const styleId = 'virtual-studio-design-tokens';
  let styleElement = document.getElementById(styleId) as HTMLStyleElement;
  
  if (!styleElement) {
    styleElement = document.createElement('style');
    styleElement.id = styleId;
    document.head.appendChild(styleElement);
  }
  
  const css = generateCSSCustomProperties();
  styleElement.textContent = css;
}

/**
 * Global styles for Virtual Studio
 */
export const globalStyles = {
  // Scrollbar styling
  scrollbar: {
    '&::-webkit-scrollbar': {
      width: '8px',
      height: '8px',
    },
    '&::-webkit-scrollbar-track': {
      backgroundColor: colors.background.base,
    },
    '&::-webkit-scrollbar-thumb': {
      backgroundColor: colors.border.default,
      borderRadius: '4px',
      '&:hover': {
        backgroundColor: colors.border.hover,
      },
    },
  },
  
  // Focus styles for accessibility
  focusRing: {
    '&:focus-visible': {
      outline: `2px solid ${colors.border.focus}`,
      outlineOffset: '2px',
    },
  },
  
  // Selection styles
  selection: {
    '&::selection': {
      backgroundColor: colors.primary,
      color: colors.text.inverse,
    },
  },
} as const;

/**
 * Apply global styles to document
 */
export function applyGlobalStyles(): void {
  if (typeof document === 'undefined') return;
  
  const styleId = 'virtual-studio-global-styles';
  let styleElement = document.getElementById(styleId) as HTMLStyleElement;
  
  if (!styleElement) {
    styleElement = document.createElement('style');
    styleElement.id = styleId;
    document.head.appendChild(styleElement);
  }
  
  const css = `
    /* Scrollbar Styles */
    * {
      scrollbar-width: thin;
      scrollbar-color: ${colors.border.default} ${colors.background.base};
    }
    
    /* Selection Styles */
    ::selection {
      background-color: ${colors.primary};
      color: ${colors.text.inverse};
    }
    
    /* Focus Styles */
    *:focus-visible {
      outline: 2px solid ${colors.border.focus};
      outline-offset: 2px;
    }
    
    /* Smooth Scrolling */
    html {
      scroll-behavior: smooth;
    }
    
    /* Prevent text selection on UI elements */
    button, [role="button"] {
      user-select: none;
    }
  `;
  
  styleElement.textContent = css;
}

/**
 * Initialize design system
 * Call this once in the root component
 */
export function initializeDesignSystem(): void {
  injectDesignTokens();
  applyGlobalStyles();
}


