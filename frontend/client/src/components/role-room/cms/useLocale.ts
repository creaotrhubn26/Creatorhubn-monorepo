/**
 * useLocale.ts
 *
 * Detekterer aktuelt språk fra URL-prefiks. Path-prefix-strategi:
 *   /en/for-studenter      → locale='en', pathname='/for-studenter'
 *   /for-studenter         → locale='no' (default), pathname='/for-studenter'
 *   /en                    → locale='en', pathname='/'
 *
 * Brukes av casting-main.tsx for å plukke riktig komponent OG
 * passe locale-flag ned til BlockRenderer.
 */

import { useMemo } from 'react';
import { DEFAULT_LOCALE, SUPPORTED_LOCALES, type Locale } from './blockSchema';

const PREFIX_BY_LOCALE: Record<Locale, string | null> = {
  no: null,
  en: '/en',
};

export interface LocaleContext {
  locale: Locale;
  pathname: string;
  /** Full URL-path inkl locale-prefix — brukes for canonical-tags. */
  fullPath: string;
}

export function detectLocale(rawPathname: string | null | undefined): LocaleContext {
  const pathname = typeof rawPathname === 'string' && rawPathname ? rawPathname : '/';
  const lower = pathname.toLowerCase();

  for (const loc of SUPPORTED_LOCALES) {
    const prefix = PREFIX_BY_LOCALE[loc];
    if (!prefix) continue;
    if (lower === prefix) {
      return { locale: loc, pathname: '/', fullPath: pathname };
    }
    if (lower.startsWith(`${prefix}/`)) {
      return {
        locale: loc,
        pathname: pathname.slice(prefix.length) || '/',
        fullPath: pathname,
      };
    }
  }

  return { locale: DEFAULT_LOCALE, pathname, fullPath: pathname };
}

export function useLocale(): LocaleContext {
  return useMemo(() => {
    if (typeof window === 'undefined') {
      return { locale: DEFAULT_LOCALE, pathname: '/', fullPath: '/' };
    }
    return detectLocale(window.location.pathname);
  }, []);
}

/**
 * Bygger den motsatte URL-en for hreflang-tags. F.eks. `/for-studenter`
 * + locale='en' → `/en/for-studenter`. Brukes i siteSeo.ts.
 */
export function buildLocalizedPath(pathname: string, locale: Locale): string {
  const prefix = PREFIX_BY_LOCALE[locale];
  if (!prefix) return pathname || '/';
  if (pathname === '/' || !pathname) return prefix;
  return `${prefix}${pathname.startsWith('/') ? pathname : `/${pathname}`}`;
}
