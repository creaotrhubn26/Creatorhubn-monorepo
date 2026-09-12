// @ts-nocheck
/**
 * wsLocale — workspace-språk for utenlandske partner-vendors.
 *
 * TeamWorkspacePage henter /api/editing/vendor/me (kun for vendor-kategorien)
 * og provider locale ('no' | 'en') via context; fanene leser med useWsLocale()
 * og oversetter via lokale no/en-ordbøker (makeT). Default er alltid 'no', så
 * faner som rendres utenfor provideren (eller før svaret) er norske som før.
 * Samme deteksjon som partner-portalen/EditingVendorWorkspace (localeForVendor).
 */
import React, { createContext, useContext } from 'react';

export type WsLocale = 'no' | 'en';

const WsLocaleContext = createContext<WsLocale>('no');

export const WsLocaleProvider = WsLocaleContext.Provider;

export function useWsLocale(): WsLocale {
  return useContext(WsLocaleContext);
}

export type WsDict = Record<string, { no: string; en: string }>;

/** Lag en t()-funksjon for en fanes ordbok: t('key') → riktig språk, nb-fallback. */
export function makeT(dict: WsDict, locale: WsLocale) {
  return (k: string): string => dict[k]?.[locale] || dict[k]?.no || k;
}

/** Datoformat-locale for toLocaleDateString/-TimeString. */
export function wsDateLocale(locale: WsLocale): string {
  return locale === 'en' ? 'en-GB' : 'nb-NO';
}
