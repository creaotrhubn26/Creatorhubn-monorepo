/**
 * WCAG & GDPR Compliance Utilities
 */

/**
 * Accessibility Helper Functions
 */
export const AccessibilityUtils = {
  /**
   * Generate unique IDs for form elements and their labels
   */
  generateId: (prefix: string): string => {
    return `${prefix}-${Math.random().toString(36).substr(2, 9)}`;
  },

  /**
   * Announce to screen readers
   */
  announce: (message: string, priority: 'polite' | 'assertive' = 'polite') => {
    const announcement = document.createElement('div');
    announcement.setAttribute('role', 'status');
    announcement.setAttribute('aria-live', priority);
    announcement.setAttribute('aria-atomic', 'true');
    announcement.style.position = 'absolute';
    announcement.style.left = '-10000px';
    announcement.textContent = message;
    document.body.appendChild(announcement);
    setTimeout(() => announcement.remove(), 1000);
  },

  /**
   * Check keyboard navigation
   */
  isKeyboardNavigable: (element: HTMLElement): boolean => {
    return !!(
      element.hasAttribute('tabindex') ||
      element.tagName === 'A' ||
      element.tagName === 'BUTTON' ||
      element.tagName === 'INPUT' ||
      element.tagName === 'SELECT' ||
      element.tagName === 'TEXTAREA'
    );
  },

  /**
   * Set focus trap for dialogs
   */
  setupFocusTrap: (dialogElement: HTMLElement) => {
    const focusableElements = dialogElement.querySelectorAll(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );
    const firstElement = focusableElements[0] as HTMLElement;
    const lastElement = focusableElements[focusableElements.length - 1] as HTMLElement;

    dialogElement.addEventListener('keydown', (e: KeyboardEvent) => {
      if (e.key === 'Tab') {
        if (e.shiftKey) {
          if (document.activeElement === firstElement) {
            e.preventDefault();
            lastElement.focus();
          }
        } else {
          if (document.activeElement === lastElement) {
            e.preventDefault();
            firstElement.focus();
          }
        }
      }
    });
  },
};

/**
 * GDPR Compliance Helper Functions
 */
export const GDPRUtils = {
  /**
   * Get user consent status from localStorage
   */
  getConsent: () => {
    const stored = localStorage.getItem('gdpr_consent');
    return stored
      ? JSON.parse(stored)
      : {
          essential: true,
          analytics: false,
          marketing: false,
          terms: false,
          acceptedAt: null,
        };
  },

  /**
   * Save user consent
   */
  setConsent: (consent: {
    essential: boolean;
    analytics: boolean;
    marketing: boolean;
    terms: boolean;
  }) => {
    localStorage.setItem(
      'gdpr_consent',
      JSON.stringify({
        ...consent,
        acceptedAt: new Date().toISOString(),
      })
    );
  },

  /**
   * Check if user has accepted terms
   */
  hasAcceptedTerms: (): boolean => {
    const consent = GDPRUtils.getConsent();
    return consent.terms === true;
  },

  /**
   * Generate data export (GDPR Right to Portability)
   */
  exportUserData: async (userId: string): Promise<Blob> => {
    try {
      const response = await fetch(`/api/users/${userId}/export-data`, {
        method: 'GET',
        headers: {
          'x-user-id': userId,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error('Failed to export data');
      }

      const data = await response.json();
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      
      // Trigger download
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `creatorhub-data-export-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);

      return blob;
    } catch (error) {
      console.error('Error exporting data:', error);
      throw error;
    }
  },

  /**
   * Request account deletion (GDPR Right to Erasure)
   */
  deleteUserAccount: async (userId: string, password: string): Promise<boolean> => {
    try {
      const response = await fetch(`/api/users/${userId}`, {
        method: 'DELETE',
        headers: {
          'x-user-id': userId,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ password }),
      });

      if (!response.ok) {
        throw new Error('Failed to delete account');
      }

      // Clear local data
      localStorage.removeItem('gdpr_consent');
      localStorage.removeItem('user_id');
      localStorage.removeItem('auth_token');

      return true;
    } catch (error) {
      console.error('Error deleting account:', error);
      throw error;
    }
  },

  /**
   * Log data processing activity
   */
  logDataProcessing: (
    userId: string,
    action: string,
    dataType: string,
    details?: Record<string, any>
  ) => {
    const log = {
      timestamp: new Date().toISOString(),
      userId,
      action,
      dataType,
      details,
    };

    // Send to backend for audit logging
    navigator.sendBeacon('/api/audit-log', JSON.stringify(log));
  },

  /**
   * Generate privacy notice
   */
  generatePrivacyNotice: (): string => {
    return `
    PERSONVERNERKLÆRING
    
    Din personvern er viktig for oss. Vi samler og behandler følgende data:
    
    1. KONTOINFORMASJON
       - Navn, e-post, telefon
       - Lagres så lenge kontoen er aktiv
    
    2. CV-DATA
       - Arbeidserfaringer, utdanning, ferdigheter
       - Du kan slette dette når som helst
    
    3. BRUKSDATA
       - IP-adresse, enhetsinformasjon, bruksmønstre
       - Lagres i maksimalt 30 dager
    
    4. COOKIES
       - Sessjonskookies for autentisering
       - Analytics for forbedring av tjenesten
    
    DINE RETTIGHETER:
    - Tilgang til dine data
    - Retting av data
    - Sletting av data
    - Dataportabilitet
    
    For spørsmål, kontakt: privacy@creatorhubnorge.no
    `;
  },
};

/**
 * WCAG Compliance Checklist
 */
export const WCAGChecklist = {
  /**
   * Verify color contrast (WCAG AA requires 4.5:1 for normal text)
   */
  checkContrast: (foreground: string, background: string): boolean => {
    // This is a simplified check - in production use a library like `contrast-ratio`
    const getLuminance = (color: string) => {
      // Convert hex to RGB and calculate relative luminance
      const rgb = parseInt(color.substring(1), 16);
      const r = (rgb >> 16) & 0xff;
      const g = (rgb >> 8) & 0xff;
      const b = (rgb >> 0) & 0xff;

      const [rs, gs, bs] = [r, g, b].map((c) => {
        c = c / 255;
        return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
      });

      return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs;
    };

    const l1 = getLuminance(foreground);
    const l2 = getLuminance(background);
    const lighter = Math.max(l1, l2);
    const darker = Math.min(l1, l2);

    return (lighter + 0.05) / (darker + 0.05) >= 4.5;
  },

  /**
   * Verify all form inputs have labels
   */
  checkFormLabels: (): boolean => {
    const inputs = document.querySelectorAll('input, select, textarea');
    let allLabeled = true;

    inputs.forEach((input) => {
      const id = input.getAttribute('id');
      const ariaLabel = input.getAttribute('aria-label');
      const associated = id ? document.querySelector(`label[for="${id}"]`) : null;

      if (!ariaLabel && !associated) {
        console.warn('Unlabeled input:', input);
        allLabeled = false;
      }
    });

    return allLabeled;
  },

  /**
   * Verify skip to main content link
   */
  hasSkipLink: (): boolean => {
    return !!document.querySelector('a[href="#main-content"]');
  },

  /**
   * Verify all images have alt text
   */
  checkAltText: (): boolean => {
    const images = document.querySelectorAll('img');
    let allHaveAlt = true;

    images.forEach((img) => {
      if (!img.hasAttribute('alt')) {
        console.warn('Image missing alt text:', img);
        allHaveAlt = false;
      }
    });

    return allHaveAlt;
  },

  /**
   * Verify heading hierarchy
   */
  checkHeadings: (): boolean => {
    const headings = document.querySelectorAll('h1, h2, h3, h4, h5, h6');
    let previousLevel = 1;
    let isValid = true;

    headings.forEach((heading) => {
      const level = parseInt(heading.tagName[1]);
      if (level > previousLevel + 1) {
        console.warn('Heading hierarchy broken:', heading, `from h${previousLevel} to h${level}`);
        isValid = false;
      }
      previousLevel = level;
    });

    return isValid;
  },

  /**
   * Run full WCAG audit
   */
  runAudit: (): Record<string, boolean> => {
    return {
      formLabels: WCAGChecklist.checkFormLabels(),
      skipLink: WCAGChecklist.hasSkipLink(),
      altText: WCAGChecklist.checkAltText(),
      headings: WCAGChecklist.checkHeadings(),
    };
  },
};

/**
 * Cookie Management
 */
export const CookieUtils = {
  /**
   * Set a cookie with GDPR compliance
   */
  setCookie: (name: string, value: string, days: number = 365) => {
    const expires = new Date();
    expires.setTime(expires.getTime() + days * 24 * 60 * 60 * 1000);
    const cookie = `${name}=${encodeURIComponent(value)};expires=${expires.toUTCString()};path=/;SameSite=Strict`;
    document.cookie = cookie;
  },

  /**
   * Get a cookie value
   */
  getCookie: (name: string): string | null => {
    const nameEQ = `${name}=`;
    const cookies = document.cookie.split(';');

    for (let cookie of cookies) {
      cookie = cookie.trim();
      if (cookie.startsWith(nameEQ)) {
        return decodeURIComponent(cookie.substring(nameEQ.length));
      }
    }

    return null;
  },

  /**
   * Delete a cookie
   */
  deleteCookie: (name: string) => {
    CookieUtils.setCookie(name, '', -1);
  },

  /**
   * Clear all cookies except essential
   */
  clearNonEssentialCookies: () => {
    const nonEssential = ['analytics_id', 'marketing_token'];
    nonEssential.forEach((name) => CookieUtils.deleteCookie(name));
  },
};
