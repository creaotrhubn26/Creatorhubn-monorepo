import { useCallback, useSyncExternalStore } from 'react';
import { getLang, setLang, subscribeLang } from './store';
import { resources, type Lang, type TranslationKey } from './resources';

export type { Lang, TranslationKey };
export { getLang, setLang };
export { LanguageSwitcher } from './LanguageSwitcher';

export type TVars = Record<string, string | number>;

/** Ren oversettelses-funksjon (utenfor render). Fallback: valgt språk → norsk → nøkkel. */
export function translate(lang: Lang, key: TranslationKey, vars?: TVars): string {
  const dict = resources[lang] ?? resources.no;
  let out: string = dict[key] ?? resources.no[key] ?? key;
  if (vars) {
    for (const [k, v] of Object.entries(vars)) {
      out = out.replace(new RegExp(`\\{${k}\\}`, 'g'), String(v));
    }
  }
  return out;
}

/** Gjeldende språk + setter, re-rendrer ved språkbytte. */
export function useLang(): [Lang, (lang: Lang) => void] {
  const lang = useSyncExternalStore(subscribeLang, getLang, getLang);
  return [lang, setLang];
}

/** Hovedhook: t(key, vars) + gjeldende språk + setLang. */
export function useT() {
  const lang = useSyncExternalStore(subscribeLang, getLang, getLang);
  const t = useCallback((key: TranslationKey, vars?: TVars) => translate(lang, key, vars), [lang]);
  return { t, lang, setLang };
}
