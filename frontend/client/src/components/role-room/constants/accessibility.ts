/**
 * Tilgjengelighet-konstanter for Role Room.
 *
 * Hovedformål: gi én SOURCE OF TRUTH for WCAG 2.2-touch-target-størrelse.
 * Tidligere ble `const TOUCH_TARGET_SIZE = 44` duplisert i 14 forskjellige
 * paneler — en risikabel praksis hvor én panel kunne divergere fra resten.
 *
 * Alle paneler bør importere disse istedenfor å definere lokalt:
 *   import { TOUCH_TARGET_SIZE } from '../constants/accessibility';
 */

/**
 * Minimum klikk/tap-target-størrelse iht. WCAG 2.2 Success Criterion 2.5.5
 * (Target Size — Minimum). 44×44 CSS-piksler er den anbefalte minste verdien.
 *
 * Sett som `minWidth` + `minHeight` på IconButton og andre interaktive
 * elementer som er mindre enn dette by default.
 */
export const TOUCH_TARGET_SIZE = 44;

/**
 * Mobile-touch-target. Brukes når komponenten har plass — gir mer "luft"
 * mellom interaktive elementer på mobil hvor finger-presisjon er lavere.
 */
export const MOBILE_TOUCH_TARGET_SIZE = 48;

/**
 * Focus-visible-styles for keyboard-navigasjon. Brukes konsekvent på
 * interaktive elementer for å gi tydelig fokus-indikator (WCAG 2.4.7).
 */
export const focusVisibleStyles = {
  '&:focus-visible': {
    outline: '2px solid #60a5fa',
    outlineOffset: 2,
  },
} as const;
