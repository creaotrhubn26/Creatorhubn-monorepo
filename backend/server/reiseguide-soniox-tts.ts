/**
 * Soniox tekst-til-tale (tts-rt-v2) over WebSocket for SenseAid Explore.
 *
 * Soniox er valgt som eneste leverandør for lyd og teksting (Daniel
 * 18.09.2026). WebSocket-varianten brukes fordi bare den gir tegnnivå-
 * tidsstempler (return_timestamps), som tekstingen bygges av. Protokollen er
 * verifisert mot @soniox/node 2.3.0 (dist/index.mjs) og
 * soniox_examples/text_to_speech/nodejs/soniox_realtime.js, se
 * docs/evidence/2026-09-soniox-stt-async-and-tts.yaml:
 *
 *   klient → { api_key, model, language, voice, audio_format, bitrate,
 *              return_timestamps, stream_id }
 *   klient → { text, text_end: true, stream_id }
 *   server → { audio: <base64>, timestamps?: { characters[],
 *              character_start_times_seconds[], character_end_times_seconds[] } }
 *   server → { audio_end } … { terminated } | { error_code, error_message }
 */

import { WebSocket } from "ws";

export const SONIOX_TTS_MODEL = "tts-rt-v2";
/**
 * Eksempelstemmen i Soniox' egen dokumentasjon. Alle Soniox-stemmer snakker
 * alle språk, så den fungerer på norsk; endelig stemme velges etter lytting
 * (SENSEAID_SONIOX_VOICE).
 */
export const SONIOX_TTS_DEFAULT_VOICE = "Adrian";
/** mp3 96 kbit/s: god talekvalitet, små filer for mobil. */
export const SONIOX_TTS_BITRATE = 96_000;

export interface CharacterTiming {
  char: string;
  startS: number;
  endS: number;
}

export interface SynthesisRequest {
  text: string;
  /** Manusets språk slik det ligger i guide_poi_scripts.lang (nb, en, …). */
  lang: string;
  voice: string;
}

export interface SpeechSynthesis {
  audio: Buffer;
  format: "mp3";
  bitrateKbps: number;
  characters: CharacterTiming[];
  /** Slutt på siste uttalte tegn, i sekunder. */
  durationS: number;
  provider: "soniox";
  model: string;
  voice: string;
}

export interface SpeechSynthesizer {
  synthesize(request: SynthesisRequest): Promise<SpeechSynthesis>;
}

export class SonioxTtsError extends Error {
  constructor(
    message: string,
    public readonly code?: string,
  ) {
    super(message);
    this.name = "SonioxTtsError";
  }
}

/**
 * Soniox-region. Et Soniox-prosjekt ligger i én region, og nøkkelen virker
 * bare mot den regionens adresser. SenseAid bruker EU (Daniel 24.09.2026);
 * SENSEAID_SONIOX_REGION kan overstyre («us» er Soniox' standard uten
 * underdomene). Adressene følger @soniox/node 2.3.0 (SonioxRegion:
 * `*.eu.soniox.com`, `*.jp.soniox.com`, US uten underdomene).
 */
export const SONIOX_DEFAULT_REGION = "eu";

/** TTS-WebSocket for regionen: wss://tts-rt.eu.soniox.com/tts-websocket osv. */
export function sonioxTtsWsUrl(region: string = SONIOX_DEFAULT_REGION): string {
  const normalized = region.trim().toLowerCase();
  if (!normalized || normalized === "us") return "wss://tts-rt.soniox.com/tts-websocket";
  if (!/^[a-z]{2}$/.test(normalized)) {
    throw new SonioxTtsError(`Ukjent Soniox-region «${region}». Bruk eu, jp eller us.`);
  }
  return `wss://tts-rt.${normalized}.soniox.com/tts-websocket`;
}

export const SONIOX_TTS_WS_URL = sonioxTtsWsUrl();

/**
 * Soniox bruker ISO 639-1; norsk er «no» (bokmål og nynorsk i samme modell).
 * Regionsuffiks (nb-NO, en-GB) strippes.
 */
export function sonioxLanguageCode(lang: string): string {
  const base = lang.trim().toLowerCase().split(/[-_]/)[0] ?? "";
  if (!base) throw new SonioxTtsError("Manuset mangler språkkode.");
  return base === "nb" || base === "nn" ? "no" : base;
}

/** Minste flate vi trenger fra ws.WebSocket, så tester kan bytte den ut. */
export interface TtsSocket {
  send(data: string): void;
  close(): void;
  on(event: "open" | "message" | "error" | "close", listener: (...args: unknown[]) => void): void;
}

export type TtsSocketFactory = (url: string) => TtsSocket;

export interface SonioxTtsOptions {
  apiKey: string;
  model?: string;
  /** Region (eu, jp, us); ignoreres når wsUrl er satt. Standard er EU. */
  region?: string;
  wsUrl?: string;
  bitrate?: number;
  timeoutMs?: number;
  connect?: TtsSocketFactory;
}

interface ServerEvent {
  audio?: string;
  timestamps?: {
    characters?: string[];
    character_start_times_seconds?: number[];
    character_end_times_seconds?: number[];
  };
  audio_end?: boolean;
  terminated?: boolean;
  error_code?: string | number;
  error_message?: string;
}

function rawToString(data: unknown): string {
  if (typeof data === "string") return data;
  if (Buffer.isBuffer(data)) return data.toString("utf8");
  if (Array.isArray(data)) return Buffer.concat(data as Buffer[]).toString("utf8");
  if (data instanceof ArrayBuffer) return Buffer.from(data).toString("utf8");
  return String(data);
}

const defaultConnect: TtsSocketFactory = (url) => new WebSocket(url) as unknown as TtsSocket;

export function createSonioxTts(options: SonioxTtsOptions): SpeechSynthesizer {
  const apiKey = options.apiKey.trim();
  if (!apiKey) throw new SonioxTtsError("Soniox-nøkkel mangler.");
  const model = options.model ?? SONIOX_TTS_MODEL;
  const wsUrl = options.wsUrl ?? sonioxTtsWsUrl(options.region);
  const bitrate = options.bitrate ?? SONIOX_TTS_BITRATE;
  const timeoutMs = options.timeoutMs ?? 180_000;
  const connect = options.connect ?? defaultConnect;

  return {
    synthesize(request) {
      const text = request.text.trim();
      if (!text) return Promise.reject(new SonioxTtsError("Manuset er tomt."));
      const language = sonioxLanguageCode(request.lang);
      const voice = request.voice.trim() || SONIOX_TTS_DEFAULT_VOICE;
      const streamId = `senseaid-${Date.now().toString(36)}`;

      return new Promise<SpeechSynthesis>((resolve, reject) => {
        const socket = connect(wsUrl);
        const audioChunks: Buffer[] = [];
        const characters: CharacterTiming[] = [];
        let settled = false;

        const timer = setTimeout(() => {
          fail(new SonioxTtsError(`Soniox svarte ikke innen ${Math.round(timeoutMs / 1000)} s.`, "timeout"));
        }, timeoutMs);

        const finish = (fn: () => void) => {
          if (settled) return;
          settled = true;
          clearTimeout(timer);
          fn();
        };
        const fail = (err: Error) =>
          finish(() => {
            try {
              socket.close();
            } catch {
              // Allerede lukket.
            }
            reject(err);
          });

        socket.on("open", () => {
          socket.send(
            JSON.stringify({
              api_key: apiKey,
              model,
              language,
              voice,
              audio_format: "mp3",
              bitrate,
              return_timestamps: true,
              stream_id: streamId,
            }),
          );
          socket.send(JSON.stringify({ text, text_end: true, stream_id: streamId }));
        });

        socket.on("message", (data) => {
          let event: ServerEvent;
          try {
            event = JSON.parse(rawToString(data)) as ServerEvent;
          } catch {
            return;
          }
          if (event.error_code !== undefined) {
            fail(
              new SonioxTtsError(
                `Soniox TTS feilet: ${event.error_code} ${event.error_message ?? ""}`.trim(),
                String(event.error_code),
              ),
            );
            return;
          }
          if (event.audio) audioChunks.push(Buffer.from(event.audio, "base64"));
          const ts = event.timestamps;
          if (ts?.characters && ts.character_start_times_seconds && ts.character_end_times_seconds) {
            for (let i = 0; i < ts.characters.length; i += 1) {
              characters.push({
                char: ts.characters[i] ?? "",
                startS: ts.character_start_times_seconds[i] ?? 0,
                endS: ts.character_end_times_seconds[i] ?? 0,
              });
            }
          }
          if (event.terminated) {
            finish(() => {
              socket.close();
              if (audioChunks.length === 0) {
                reject(new SonioxTtsError("Soniox ga ingen lyd.", "empty_audio"));
                return;
              }
              if (characters.length === 0) {
                reject(new SonioxTtsError("Soniox ga ingen tidsstempler; tekstingen kan ikke bygges.", "no_timestamps"));
                return;
              }
              const durationS = characters.reduce((max, c) => Math.max(max, c.endS), 0);
              resolve({
                audio: Buffer.concat(audioChunks),
                format: "mp3",
                bitrateKbps: Math.round(bitrate / 1000),
                characters,
                durationS,
                provider: "soniox",
                model,
                voice,
              });
            });
          }
        });

        socket.on("error", (err) => {
          const message = err instanceof Error ? err.message : String(err);
          fail(new SonioxTtsError(`WebSocket-feil mot Soniox: ${message}`, "websocket"));
        });

        socket.on("close", () => {
          fail(new SonioxTtsError("Soniox lukket forbindelsen før syntesen var ferdig.", "closed"));
        });
      });
    },
  };
}
