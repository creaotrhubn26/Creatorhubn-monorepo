import type { LanguageCode } from '../data/types';
import { UI_STRINGS, type UiKey } from './ui';

export interface LanguageInfo {
  code: LanguageCode;
  /** Språkets eget navn (endonym) – slik brukeren kjenner det igjen. */
  label: string;
  /** BCP 47-tag brukt for tale og Intl. */
  bcp47: string;
  dir: 'ltr' | 'rtl';
}

export const UI_LANGUAGES: readonly LanguageInfo[] = [
  { code: 'nb', label: 'Norsk', bcp47: 'nb-NO', dir: 'ltr' },
  { code: 'en', label: 'English', bcp47: 'en-GB', dir: 'ltr' },
  { code: 'de', label: 'Deutsch', bcp47: 'de-DE', dir: 'ltr' },
  { code: 'fr', label: 'Français', bcp47: 'fr-FR', dir: 'ltr' },
  { code: 'es', label: 'Español', bcp47: 'es-ES', dir: 'ltr' },
  { code: 'it', label: 'Italiano', bcp47: 'it-IT', dir: 'ltr' },
  { code: 'pl', label: 'Polski', bcp47: 'pl-PL', dir: 'ltr' },
  { code: 'uk', label: 'Українська', bcp47: 'uk-UA', dir: 'ltr' },
  { code: 'ja', label: '日本語', bcp47: 'ja-JP', dir: 'ltr' },
  { code: 'zh', label: '中文', bcp47: 'zh-CN', dir: 'ltr' },
  { code: 'ar', label: 'العربية', bcp47: 'ar-SA', dir: 'rtl' },
];

export function languageInfo(code: LanguageCode): LanguageInfo {
  return UI_LANGUAGES.find((l) => l.code === code) ?? UI_LANGUAGES[1];
}

export function isLanguageCode(value: string): value is LanguageCode {
  return UI_LANGUAGES.some((l) => l.code === value);
}

/** Velger startspråk fra nettleseren, ellers engelsk. */
export function detectLanguage(): LanguageCode {
  if (typeof navigator === 'undefined') return 'en';
  for (const tag of navigator.languages ?? [navigator.language]) {
    const primary = tag.toLowerCase().split('-')[0];
    const mapped = primary === 'no' || primary === 'nn' ? 'nb' : primary;
    if (isLanguageCode(mapped)) return mapped;
  }
  return 'en';
}

export type Translate = (key: UiKey, vars?: Record<string, string | number>) => string;

export function makeTranslate(lang: LanguageCode): Translate {
  const table = UI_STRINGS[lang] ?? UI_STRINGS.en;
  return (key, vars) => {
    let s: string = table[key] ?? UI_STRINGS.en[key] ?? key;
    if (vars) {
      for (const [k, v] of Object.entries(vars)) s = s.split(`{${k}}`).join(String(v));
    }
    return s;
  };
}
