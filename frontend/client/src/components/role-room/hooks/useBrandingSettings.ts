import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { fetchBrandingSettings, getBrandingSettings, getLabelsForLang, subscribeBrandingSettings, type BrandingSettings } from "../config/branding";
import { getLang, subscribeLang } from "../../../i18n/store";

export function useBrandingSettings(): BrandingSettings {
  const [branding, setBranding] = useState<BrandingSettings>(getBrandingSettings());
  // Følg app-språket: bytte NO↔EN må re-rendre og bytte label-kartet.
  const lang = useSyncExternalStore(subscribeLang, getLang, getLang);

  useEffect(() => {
    let isMounted = true;
    fetchBrandingSettings()
      .then(settings => {
        if (isMounted && settings) {
          setBranding(settings);
        }
      })
      .catch(() => {
        // Ignore fetch errors - defaults remain
      });
    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    return subscribeBrandingSettings(setBranding);
  }, []);

  // Bytt inn språk-riktig label-kart. Norsk gir kilde-objektet uendret (samme
  // referanse) — kun engelsk lager et nytt objekt. Alle branding.tokens.labels.X-
  // kallsteder blir dermed tospråklige uten endring.
  return useMemo(() => {
    if (lang === 'no') return branding;
    return {
      ...branding,
      tokens: { ...branding.tokens, labels: getLabelsForLang(lang, branding.tokens.labels) },
    };
  }, [branding, lang]);
}

export default useBrandingSettings;
