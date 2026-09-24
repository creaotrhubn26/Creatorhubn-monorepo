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
  /** Valgfri: Soniox-stemmenavn (standard i reiseguide-soniox-tts.ts). */
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

/** Statusoversikt uten verdier, til admin-/helsesjekk og feilsøking. */
export function senseAidEnvStatus(env: NodeJS.ProcessEnv = process.env): Record<string, boolean> {
  return Object.fromEntries(Object.values(SENSEAID_ENV).map((name) => [name, Boolean(read(env, name))]));
}
