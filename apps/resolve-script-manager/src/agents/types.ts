/**
 * AgentConfig — felles kontrakt for alle agenter i Post Agent.
 *
 * Hver agent (Wedding, Music Video, Corporate, Event …) implementerer
 * denne, slik at deres CreativeEditor-variant kan injisere riktig
 * domene-kunnskap uten å eie hele editor-stack-en.
 *
 * Wedding Agent eksisterer i dag som default i CreativeEditorView med
 * hardkodede prompts/chapters/signal-weights. Nye agenter (som Music
 * Video) bor i agents/<kind>/ og rendres via egen Editor-view.
 */

export type AgentKind =
  | "wedding" | "music_video" | "corporate"
  | "event" | "documentary" | "screen_recording"
  | "podcast" | "short_film";

/** Chapter = en navngitt seksjon i prosjektet (vielse, chorus, keynote …). */
export interface ChapterDef {
  id: string;
  label: string;
  /** Indikative mål-prosent av total leveranse for denne kapittel-typen. */
  pacingPct?: number;
  /** Beskrivelse av hva som typisk skjer her — brukt i Claude-prompt. */
  description: string;
  /** Hint til auto-pilot om hva som skal prioriteres (tempo, energi, fokus). */
  priorityHint: "high-energy" | "emotional-peak" | "atmospheric" | "informational" | "transitional";
}

/** Signal-vekter brukt av auto-pilot's quality-scoring per pick. */
export interface SignalWeights {
  [signalId: string]: number; // 0..1 typisk
}

/** Look-pack = en navngitt color/grade-stil med tags. */
export interface LookPackDef {
  id: string;
  label: string;
  /** Kort beskrivelse til Bjarne — hva look-en gjør. */
  description: string;
  /** Genre/mood tags. Brukes for filtrering og Claude-context. */
  tags: string[];
  /** Resolve color-direction (passes til claude_color_direction.py). */
  colorDirection: {
    contrast: "low" | "medium" | "high";
    saturation: "muted" | "natural" | "vibrant";
    temperature: "cool" | "neutral" | "warm";
    blackPoint: "lifted" | "natural" | "crushed";
    grain: "none" | "subtle" | "noticeable";
    specials?: string[]; // f.eks. ["chromatic-aberration", "halation"]
  };
}

/** Domain-spesifikk Claude-persona som assist-panelet bruker. */
export interface AgentPersona {
  /** Navn vist i UI ("Music Video Agent", "Wedding Agent"). */
  name: string;
  /** Kort tagline til kort-visning. */
  tagline: string;
  /** System-prompt til Claude — på norsk, bygd inn med agent-konteksten. */
  systemPrompt: string;
}

/** Komplett AgentConfig — én pr agent-kind. */
export interface AgentConfig {
  kind: AgentKind;
  name: string;
  tagline: string;
  /** Hvilken type leveranse agenten lager (highlight, music-video, promo). */
  deliveryType: string;
  /** Default-varighet på leveransen i sekunder. */
  defaultDurationSec: number;
  /** Cinematic-format default (vertical/square/landscape). */
  defaultAspect: "9:16" | "1:1" | "16:9" | "4:5";
  chapters: ChapterDef[];
  signalWeights: SignalWeights;
  lookPacks: LookPackDef[];
  /** Domain-agent som hovedrolle for Claude-panel. */
  primaryAgent: AgentPersona;
  /** Tilleggsagenter som kan velges (audio, vision …). */
  supportingAgents?: AgentPersona[];
  /** Eksempler på client-wishes som vises som placeholder. */
  clientWishesExamples: string[];
  /** Tekst/oppfordringer vist i onboarding for denne agenten. */
  onboarding: {
    title: string;
    subtitle: string;
    iconHint: string; // MUI icon-navn
  };
}
