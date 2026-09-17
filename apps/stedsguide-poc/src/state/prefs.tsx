import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { LanguageCode, LatLng } from '../data/types';
import { detectLanguage, languageInfo, makeTranslate, type Translate } from '../i18n';
import { EMPTY_ENTITLEMENTS, type Entitlements } from '../lib/entitlements';
import { loadJson, saveJson } from '../lib/storage';

export type TextSize = 'normal' | 'large' | 'xlarge';

export interface Prefs {
  lang: LanguageCode;
  textSize: TextSize;
  highContrast: boolean;
  reduceMotion: boolean;
  haptics: boolean;
  captions: boolean;
  audioDescription: boolean;
  /** Talehastighet 0.7–1.4 */
  rate: number;
}

const DEFAULT_PREFS: Prefs = {
  lang: detectLanguage(),
  textSize: 'normal',
  highContrast: false,
  reduceMotion: typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches,
  haptics: true,
  captions: true,
  audioDescription: false,
  rate: 1,
};

interface AppState {
  prefs: Prefs;
  setPrefs: (patch: Partial<Prefs>) => void;
  t: Translate;
  /** BCP 47 for Intl og tale. */
  locale: string;
  dir: 'ltr' | 'rtl';
  savedIds: string[];
  toggleSaved: (id: string) => void;
  entitlements: Entitlements;
  setEntitlements: (next: Entitlements) => void;
  /** Overstyrt posisjon for demo/testing, ellers null. */
  demoPosition: LatLng | null;
  setDemoPosition: (p: LatLng | null) => void;
  /** Sist avspilte segment per severdighet, for «Fortsett guiden». */
  progress: Record<string, number>;
  setProgress: (attractionId: string, segmentIndex: number) => void;
}

const Ctx = createContext<AppState | null>(null);

export function AppStateProvider({ children }: { children: ReactNode }) {
  const [prefs, setPrefsState] = useState<Prefs>(() => loadJson('prefs', DEFAULT_PREFS));
  const [savedIds, setSavedIds] = useState<string[]>(() => loadJson<{ ids: string[] }>('saved', { ids: [] }).ids);
  const [entitlements, setEntitlementsState] = useState<Entitlements>(() => loadJson('entitlements', EMPTY_ENTITLEMENTS));
  const [demoPosition, setDemoPositionState] = useState<LatLng | null>(
    () => loadJson<{ pos: LatLng | null }>('demoPosition', { pos: null }).pos,
  );
  const [progress, setProgressState] = useState<Record<string, number>>(() => loadJson('progress', {}));

  useEffect(() => saveJson('prefs', prefs), [prefs]);
  useEffect(() => saveJson('saved', { ids: savedIds }), [savedIds]);
  useEffect(() => saveJson('entitlements', entitlements), [entitlements]);
  useEffect(() => saveJson('demoPosition', { pos: demoPosition }), [demoPosition]);
  useEffect(() => saveJson('progress', progress), [progress]);

  const info = languageInfo(prefs.lang);

  // Speil språk, retning, tekststørrelse og kontrast til <html> – det er
  // der skjermlesere og CSS leser dem.
  useEffect(() => {
    const root = document.documentElement;
    root.lang = info.bcp47;
    root.dir = info.dir;
    root.dataset.textSize = prefs.textSize;
    root.dataset.contrast = prefs.highContrast ? 'high' : 'normal';
    root.dataset.motion = prefs.reduceMotion ? 'reduce' : 'normal';
  }, [info.bcp47, info.dir, prefs.textSize, prefs.highContrast, prefs.reduceMotion]);

  const setPrefs = useCallback((patch: Partial<Prefs>) => setPrefsState((p) => ({ ...p, ...patch })), []);
  const toggleSaved = useCallback(
    (id: string) => setSavedIds((ids) => (ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id])),
    [],
  );
  const setProgress = useCallback(
    (attractionId: string, segmentIndex: number) =>
      setProgressState((p) => (p[attractionId] === segmentIndex ? p : { ...p, [attractionId]: segmentIndex })),
    [],
  );

  const value = useMemo<AppState>(
    () => ({
      prefs,
      setPrefs,
      t: makeTranslate(prefs.lang),
      locale: info.bcp47,
      dir: info.dir,
      savedIds,
      toggleSaved,
      entitlements,
      setEntitlements: setEntitlementsState,
      demoPosition,
      setDemoPosition: setDemoPositionState,
      progress,
      setProgress,
    }),
    [prefs, setPrefs, info.bcp47, info.dir, savedIds, toggleSaved, entitlements, demoPosition, progress, setProgress],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAppState(): AppState {
  const v = useContext(Ctx);
  if (!v) throw new Error('useAppState must be used inside AppStateProvider');
  return v;
}
