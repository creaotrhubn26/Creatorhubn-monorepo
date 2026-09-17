/** Språkkode (BCP 47-primærtag). UI-strenger finnes for alle i `UI_LANGUAGES`. */
export type LanguageCode =
  | 'nb' | 'en' | 'de' | 'fr' | 'es' | 'it' | 'pl' | 'uk' | 'ja' | 'zh' | 'ar';

export interface LatLng {
  lat: number;
  lng: number;
}

/**
 * Ett fortellingssegment. `narration` er det guiden sier.
 * `audioDescription` er synstolking: en beskrivelse av det synlige
 * på dette punktet, for blinde og svaksynte. Spilles av *før*
 * `narration` når synstolking er slått på.
 */
export interface GuideSegment {
  id: string;
  narration: string;
  audioDescription: string;
}

export interface GuideScript {
  /** Kort introduksjon (vises i kortet før kjøp). */
  intro: string;
  /** Synstolket «her står du»-beskrivelse av stedet som helhet. */
  sceneDescription: string;
  segments: GuideSegment[];
}

export interface Attraction {
  id: string;
  /** Navn per språk; faller tilbake til `en`. */
  name: Partial<Record<LanguageCode, string>> & { en: string };
  /** Sted/by, ikke oversatt. */
  place: string;
  country: string;
  position: LatLng;
  /** Varighet på guiden i minutter (omtrent). */
  durationMin: number;
  /** Pris for quick buy, NOK. */
  quickBuyNok: number;
  /** Fargetema for hero (POC bruker gradient i stedet for bilder). */
  hue: number;
  /** Alt-tekst for hero-flaten, per språk. */
  heroAlt: Partial<Record<LanguageCode, string>> & { en: string };
  scripts: Partial<Record<LanguageCode, GuideScript>> & { en: GuideScript };
}
