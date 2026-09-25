/**
 * Miljøvariabler for lydguide-POC-en (SenseAid Explore).
 *
 * SenseAid har egne API-nøkler per tjeneste, adskilt fra resten av
 * CreatorHub (Daniel 18.09.2026). Navnene følger repoets mønster
 * <produkt>_<tjeneste>_API_KEY (jf. ROLE_ROOM_RESEND_API_KEY) og settes i
 * Render på backend-tjenesten. Det er bevisst ingen fallback til de delte
 * nøklene (OPENAI_API_KEY, ELEVENLABS_API_KEY): mangler SenseAid-nøkkelen,
 * skal steget feile med en feilmelding som navngir variabelen, ikke bruke
 * feil konto i det stille.
 */

export const SENSEAID_ENV = {
  /**
   * Soniox: én leverandør for alt (Daniel 18.09.2026): TTS-stemmen som leser
   * fortelling og synstolking (tts-rt-v2) og ordtider/teksting.
   */
  sonioxApiKey: "SENSEAID_SONIOX_API_KEY",
  /**
   * Valgfri: Soniox-stemmenavn for alle språk (standard i
   * reiseguide-soniox-tts.ts). Et språk kan få egen stemme med
   * SENSEAID_SONIOX_VOICE_<SPRÅK>, se sonioxVoiceEnvForLang.
   */
  sonioxVoice: "SENSEAID_SONIOX_VOICE",
  /** Valgfri: Soniox-region (eu, jp, us); standard er US (Daniel 24.09.2026). */
  sonioxRegion: "SENSEAID_SONIOX_REGION",
  /** Valgfri: base-URL for lyd/bilder (standard er R2-bøtta bak /cdn/*). */
  mediaUrlBase: "REISEGUIDE_MEDIA_URL_BASE",
} as const;

export class MissingSenseAidEnvError extends Error {
  constructor(public readonly variable: string) {
    super(
      `Miljøvariabelen ${variable} er ikke satt. Legg den inn i Render på backend-tjenesten (SenseAid har egne nøkler per tjeneste).`,
    );
    this.name = "MissingSenseAidEnvError";
  }
}

function read(env: NodeJS.ProcessEnv, name: string): string | undefined {
  const value = env[name]?.trim();
  return value ? value : undefined;
}

/** Leser en påkrevd SenseAid-nøkkel; kaster MissingSenseAidEnvError hvis den mangler. */
export function requireSenseAidEnv(
  name: (typeof SENSEAID_ENV)[keyof typeof SENSEAID_ENV],
  env: NodeJS.ProcessEnv = process.env,
): string {
  const value = read(env, name);
  if (!value) throw new MissingSenseAidEnvError(name);
  return value;
}

/**
 * Navnet på stemmevariabelen for ett språk: nb → SENSEAID_SONIOX_VOICE_NB.
 * Hver Soniox-stemme snakker alle språk, men med sin egen aksent, så norsk
 * trenger en stemme med norsk aksent (Daniel 25.09.2026: «Adrian» låt dansk).
 */
export function sonioxVoiceEnvForLang(lang: string): string {
  return `${SENSEAID_ENV.sonioxVoice}_${langBase(lang).toUpperCase()}`;
}

export interface SenseAidVoice {
  /** Soniox-stemmenavnet, lagret som guide_poi_audio.voice_id. */
  id: string;
  /** Navnet brukeren ser i appen. */
  name: string;
  gender: "female" | "male";
}

/**
 * Stemmene brukeren kan velge mellom per språk, i foretrukket rekkefølge
 * (den første er standard). Daniel 25.09.2026: Hazel og Walter har norsk
 * aksent; i appen får de norske navn. Språk som ikke står her, har én stemme
 * (sonioxVoicesForLang).
 */
export const SENSEAID_VOICE_CATALOG: Readonly<Record<string, readonly SenseAidVoice[]>> = {
  nb: [
    { id: "Hazel", name: "Hedda", gender: "female" },
    { id: "Walter", name: "Vidar", gender: "male" },
  ],
};

function langBase(lang: string): string {
  return lang.trim().toLowerCase().split(/[-_]/)[0] ?? "";
}

/** Stemmene appen kan velge mellom for ett språk (tom liste = ingen valg). */
export function senseAidVoicesForLang(lang: string): readonly SenseAidVoice[] {
  return SENSEAID_VOICE_CATALOG[langBase(lang)] ?? [];
}

/** Alle katalogstemmer, standardstemmen først for hvert språk (API-ets rekkefølge). */
export function senseAidVoicePreference(): string[] {
  return Object.values(SENSEAID_VOICE_CATALOG).flatMap((voices) => voices.map((v) => v.id));
}

/**
 * Stemmene lydjobben lager lyd med for ett språk:
 * SENSEAID_SONIOX_VOICE_<SPRÅK> (kommaseparert), ellers katalogen, ellers
 * SENSEAID_SONIOX_VOICE, ellers `fallback`.
 */
export function sonioxVoicesForLang(lang: string, fallback: string, env: NodeJS.ProcessEnv = process.env): string[] {
  const fromEnv = read(env, sonioxVoiceEnvForLang(lang))
    ?.split(",")
    .map((v) => v.trim())
    .filter(Boolean);
  if (fromEnv?.length) return fromEnv;
  const catalog = senseAidVoicesForLang(lang);
  if (catalog.length > 0) return catalog.map((v) => v.id);
  return [read(env, SENSEAID_ENV.sonioxVoice) ?? fallback];
}

/** Statusoversikt uten verdier, til admin-/helsesjekk og feilsøking. */
export function senseAidEnvStatus(env: NodeJS.ProcessEnv = process.env): Record<string, boolean> {
  return Object.fromEntries(Object.values(SENSEAID_ENV).map((name) => [name, Boolean(read(env, name))]));
}
