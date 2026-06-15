/**
 * audio-showcase-routes.ts
 * ───────────────────────────────────────────────────────────────────────────
 * Audio Showcase MVP-API (jf. spec §23/§30): prosjekt → versjoner → tidskodede
 * kommentarer + seksjoner + godkjenninger + leveranser. Et profesjonelt
 * mix/master-review-rom.
 *
 * Eier (produsent) styres av requireUserSession. Kommentarer kan legges av
 * enhver innlogget (band/manager) — rolle-basert tilgang er V2 (spec §31).
 */

import type express from "express";
import { randomUUID, createHash } from "node:crypto";
import { readFileSync, createReadStream } from "node:fs";
import { writeFile, unlink } from "node:fs/promises";
import { dirname, join } from "node:path";
import { tmpdir } from "node:os";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import PDFDocument from "pdfkit";

// Innebygd TrueType-font (DejaVu Sans, libre) — sikrer at avtale-PDF rendres
// identisk i alle visere (pdfkit-standardfonter rendres ikke i alle renderere).
const FONT_DIR = join(dirname(fileURLToPath(import.meta.url)), "assets", "fonts");
let PDF_FONTS: { regular: Buffer; bold: Buffer; oblique: Buffer } | null = null;
function pdfFonts() {
  if (!PDF_FONTS) PDF_FONTS = {
    regular: readFileSync(join(FONT_DIR, "DejaVuSans.ttf")),
    bold: readFileSync(join(FONT_DIR, "DejaVuSans-Bold.ttf")),
    oblique: readFileSync(join(FONT_DIR, "DejaVuSans-Oblique.ttf")),
  };
  return PDF_FONTS;
}

// Fallback-logo (CreatorHub) — brukes når produsenten ikke har lastet opp egen.
const BRAND_DIR = join(dirname(fileURLToPath(import.meta.url)), "assets", "brand");
let FALLBACK_LOGO: Buffer | null | undefined;
function fallbackLogo(): Buffer | null {
  if (FALLBACK_LOGO === undefined) { try { FALLBACK_LOGO = readFileSync(join(BRAND_DIR, "creatorhub-logo.png")); } catch { FALLBACK_LOGO = null; } }
  return FALLBACK_LOGO;
}

// ── Video-generering (ffmpeg) for YouTube-publisering ───────────────────────
// Render sangtekst til en høy, transparent PNG (1920 bred) via sharp+SVG.
// Overlegges og rulles i ffmpeg — robust (sharp har prebygd binær, ingen freetype-
// avhengighet i ffmpeg). Mørk kontur (paint-order) gjør teksten lesbar på cover.
async function renderLyricsImage(lyrics: string, title: string, artist: string): Promise<{ buffer: Buffer; height: number }> {
  const sharp = (await import("sharp")).default;
  const W = 1920, LINE_H = 66, FS = 46, TOP = 1080 + 60, BOTTOM = 1080, WRAP = 60;
  const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const wrap = (ln: string): string[] => {
    if (!ln.trim()) return [""];
    const out: string[] = []; let cur = "";
    for (const w of ln.split(/\s+/)) { const t = cur ? cur + " " + w : w; if (t.length > WRAP && cur) { out.push(cur); cur = w; } else cur = t; }
    if (cur) out.push(cur); return out;
  };
  const lines = lyrics.replace(/\r/g, "").split("\n").flatMap(wrap);
  const height = TOP + lines.length * LINE_H + BOTTOM;
  const textEls = lines.map((ln, i) => ln ? `<text x="960" y="${TOP + i * LINE_H}" font-size="${FS}" fill="#ffffff" stroke="rgba(0,0,0,0.55)" stroke-width="4" paint-order="stroke" text-anchor="middle" font-family="sans-serif">${esc(ln)}</text>` : "").join("");
  const titleEl = `<text x="960" y="${TOP - 110}" font-size="74" font-weight="bold" fill="#ffffff" stroke="rgba(0,0,0,0.6)" stroke-width="5" paint-order="stroke" text-anchor="middle" font-family="sans-serif">${esc(title)}</text>`;
  const artistEl = artist ? `<text x="960" y="${TOP - 50}" font-size="42" fill="#ffffff" fill-opacity="0.88" stroke="rgba(0,0,0,0.55)" stroke-width="4" paint-order="stroke" text-anchor="middle" font-family="sans-serif">${esc(artist)}</text>` : "";
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${height}">${titleEl}${artistEl}${textEls}</svg>`;
  const buffer = await sharp(Buffer.from(svg)).png().toBuffer();
  return { buffer, height };
}

// Varighet (sek) på en lydfil via ffprobe (0 ved feil).
function probeDuration(path: string): Promise<number> {
  return new Promise((resolve) => {
    const pr = spawn(process.env.FFPROBE_PATH || "ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "default=nw=1:nk=1", path]);
    let out = ""; pr.stdout.on("data", (d) => { out += d.toString(); });
    pr.on("error", () => resolve(0));
    pr.on("close", () => resolve(Number(out.trim()) || 0));
  });
}

const KARAOKE_SLOT = 150;
// Stablet tekst (én linje per slot, sentrert) for beat-synket karaoke.
async function renderStackedLyrics(lines: string[]): Promise<Buffer> {
  const sharp = (await import("sharp")).default;
  const W = 1920, FS = 56, SLOT = KARAOKE_SLOT;
  const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const els = lines.map((ln, i) => `<text x="960" y="${i * SLOT + SLOT / 2 + FS / 3}" font-size="${FS}" font-weight="bold" fill="#ffffff" stroke="rgba(0,0,0,0.6)" stroke-width="5" paint-order="stroke" text-anchor="middle" font-family="sans-serif">${esc(ln)}</text>`).join("");
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${lines.length * SLOT}">${els}</svg>`;
  return sharp(Buffer.from(svg)).png().toBuffer();
}
// Vignett som mørklegger topp/bunn så aktiv (sentrert) linje er i fokus.
async function renderVignette(): Promise<Buffer> {
  const sharp = (await import("sharp")).default;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1920" height="1080"><defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="black" stop-opacity="0.88"/><stop offset="0.34" stop-color="black" stop-opacity="0"/><stop offset="0.66" stop-color="black" stop-opacity="0"/><stop offset="1" stop-color="black" stop-opacity="0.88"/></linearGradient></defs><rect width="1920" height="1080" fill="url(#g)"/></svg>`;
  return sharp(Buffer.from(svg)).png().toBuffer();
}

// Lag video fra cover + master-lyd.
//  - karaoke: stablet tekst hopper slik at aktiv linje sentreres på sitt tidsstempel.
//  - scroll: hele teksten ruller jevnt.
//  - ellers: visualizer (cover sentrert på sort 16:9).
function buildVideo(coverPath: string, audioPath: string, outPath: string, opts?: {
  lyricsImagePath?: string; lyricsHeight?: number; durationSec?: number;
  karaoke?: { stackedPath: string; vignettePath: string; starts: number[] };
}): Promise<void> {
  return new Promise((resolve, reject) => {
    let args: string[];
    if (opts?.karaoke) {
      const { stackedPath, vignettePath, starts } = opts.karaoke;
      const K = 540 + KARAOKE_SLOT / 2;
      const yexpr = `${K}-${KARAOKE_SLOT}*(${starts.map((s) => `gte(t\\,${s.toFixed(2)})`).join("+")})`;
      args = [
        "-y", "-loop", "1", "-i", coverPath, "-loop", "1", "-i", stackedPath, "-loop", "1", "-i", vignettePath, "-i", audioPath,
        "-filter_complex",
        `[0:v]scale=1920:1080:force_original_aspect_ratio=increase,crop=1920:1080,boxblur=24:2,eq=brightness=-0.4:saturation=1.05[bg];` +
        `[bg][1:v]overlay=x=(W-w)/2:y=${yexpr}[a];[a][2:v]overlay=0:0:format=auto,format=yuv420p[v]`,
        "-map", "[v]", "-map", "3:a",
        "-c:v", "libx264", "-preset", "veryfast", "-r", "25", "-c:a", "aac", "-b:a", "256k", "-shortest", "-movflags", "+faststart", outPath,
      ];
    } else if (opts?.lyricsImagePath && opts.lyricsHeight) {
      const dur = Math.max(opts.durationSec || 0, 1);
      const speed = Math.max(30, Math.round((opts.lyricsHeight + 1080) / dur));
      args = [
        "-y", "-loop", "1", "-i", coverPath, "-loop", "1", "-i", opts.lyricsImagePath, "-i", audioPath,
        "-filter_complex",
        `[0:v]scale=1920:1080:force_original_aspect_ratio=increase,crop=1920:1080,boxblur=22:2,eq=brightness=-0.34:saturation=1.05[bg];` +
        `[bg][1:v]overlay=x=(W-w)/2:y=H-t*${speed}:format=auto,format=yuv420p[v]`,
        "-map", "[v]", "-map", "2:a",
        "-c:v", "libx264", "-preset", "veryfast", "-r", "25", "-c:a", "aac", "-b:a", "256k", "-shortest", "-movflags", "+faststart", outPath,
      ];
    } else {
      args = [
        "-y", "-loop", "1", "-i", coverPath, "-i", audioPath,
        "-c:v", "libx264", "-tune", "stillimage", "-preset", "veryfast", "-r", "25",
        "-vf", "scale=1080:1080:force_original_aspect_ratio=decrease,pad=1920:1080:(ow-iw)/2:(oh-ih)/2:color=black,format=yuv420p",
        "-c:a", "aac", "-b:a", "256k", "-shortest", "-movflags", "+faststart", outPath,
      ];
    }
    const ff = spawn(process.env.FFMPEG_PATH || "ffmpeg", args);
    let err = "";
    ff.stderr.on("data", (d) => { err += d.toString(); });
    ff.on("error", reject);
    ff.on("close", (code) => (code === 0 ? resolve() : reject(new Error("ffmpeg_failed: " + err.slice(-500)))));
  });
}

// Ikke-tomme tekstlinjer (uten seksjonsmarkører) — grunnlag for tap-to-time.
function lyricLines(lyrics: string): string[] {
  return lyrics.replace(/\r/g, "").split("\n").map((l) => l.trim()).filter((l) => l && !/^\[[^\]]*\]$/.test(l));
}

// Spotify Canvas: 9:16, ~6 s SØMLØS loop fra coveret. Uskarp bakgrunn + skarpt
// cover som driver sinusformet (perfekt loop, ingen «hopp»). Med audioPath legges
// et audio-reaktivt bølgelag i merkefargen nederst. Stille MP4 (Canvas har ikke lyd).
function buildCanvas(coverPath: string, outPath: string, opts?: { audioPath?: string; audioStart?: number; accentHex?: string; bpm?: number; square?: boolean }): Promise<void> {
  return new Promise((resolve, reject) => {
    const P = 6; // loop-periode = klipplengde → sømløst
    const W = 1080, H = opts?.square ? 1080 : 1920;          // square = Apple Music motion art
    const fgSize = opts?.square ? 760 : 920, waveH = opts?.square ? 140 : 200, waveY = opts?.square ? "H-170" : "H-260";
    const accent = (opts?.accentHex && /^#[0-9a-fA-F]{6}$/.test(opts.accentHex)) ? "0x" + opts.accentHex.slice(1) : "0xffffff";
    const driftX = `(W-w)/2+22*sin(2*PI*t/${P})`;
    const driftY = `(H-h)/2+26*sin(2*PI*t/${P}+1.6)`;
    // Beat-puls: lett zoom på slaget (fra BPM). on = utframe, 1500 = 60*25fps.
    const bpm = Number(opts?.bpm);
    const pulse = bpm > 20 && bpm < 300 ? `,zoompan=z='1+0.025*abs(sin(PI*on*${Math.round(bpm)}/1500))':d=1:s=${W}x${H}:fps=25` : "";
    const inputs = ["-loop", "1", "-i", coverPath];
    if (opts?.audioPath) inputs.push("-ss", String(Math.max(0, opts.audioStart || 0)), "-t", String(P), "-i", opts.audioPath);
    const layers =
      `[0:v]scale=${W}:${H}:force_original_aspect_ratio=increase,crop=${W}:${H},boxblur=20,eq=brightness=-0.16[bg];` +
      `[0:v]scale=${fgSize}:${fgSize}:force_original_aspect_ratio=decrease[cv];`;
    const fc = opts?.audioPath
      ? `${layers}[bg][cv]overlay=x='${driftX}':y='${driftY}'[base];[1:a]showwaves=s=${W}x${waveH}:mode=cline:colors=${accent}:rate=25,format=rgba,colorchannelmixer=aa=0.55[w];[base][w]overlay=x=0:y=${waveY},format=yuv420p${pulse}[v]`
      : `${layers}[bg][cv]overlay=x='${driftX}':y='${driftY}',format=yuv420p${pulse}[v]`;
    const args = [
      "-y", ...inputs, "-t", String(P), "-r", "25",
      "-filter_complex", fc, "-map", "[v]",
      "-c:v", "libx264", "-preset", "veryfast", "-pix_fmt", "yuv420p", "-movflags", "+faststart", outPath,
    ];
    const ff = spawn(process.env.FFMPEG_PATH || "ffmpeg", args);
    let err = ""; ff.stderr.on("data", (d) => { err += d.toString(); });
    ff.on("error", reject);
    ff.on("close", (code) => (code === 0 ? resolve() : reject(new Error("ffmpeg_failed: " + err.slice(-400)))));
  });
}

// Prosesser et produsent-opplastet klipp til Canvas-spec: 9:16, 1080×1920,
// trimmet til ~6 s fra startoffset, lyd fjernet (Canvas er stille).
function buildCanvasFromClip(clipPath: string, outPath: string, opts?: { start?: number }): Promise<void> {
  return new Promise((resolve, reject) => {
    const args = [
      "-y", "-ss", String(Math.max(0, opts?.start || 0)), "-i", clipPath, "-t", "6", "-an",
      "-vf", "scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,format=yuv420p",
      "-r", "25", "-c:v", "libx264", "-preset", "veryfast", "-pix_fmt", "yuv420p", "-movflags", "+faststart", outPath,
    ];
    const ff = spawn(process.env.FFMPEG_PATH || "ffmpeg", args);
    let err = ""; ff.stderr.on("data", (d) => { err += d.toString(); });
    ff.on("error", reject);
    ff.on("close", (code) => (code === 0 ? resolve() : reject(new Error("ffmpeg_failed: " + err.slice(-400)))));
  });
}

// Reels/TikTok-klipp: 9:16 MED lyd (cover på uskarp bg + audio-reaktiv bølge),
// kappet til maxSec. For deling på sosiale medier (i motsetning til stille Canvas).
function buildSocialClip(coverPath: string, audioPath: string, outPath: string, opts?: { accentHex?: string; maxSec?: number; start?: number }): Promise<void> {
  return new Promise((resolve, reject) => {
    const accent = (opts?.accentHex && /^#[0-9a-fA-F]{6}$/.test(opts.accentHex)) ? "0x" + opts.accentHex.slice(1) : "0xffffff";
    const max = Math.min(Math.max(opts?.maxSec || 60, 5), 90);
    const fc =
      `[0:v]scale=1300:2300:force_original_aspect_ratio=increase,crop=1080:1920,boxblur=18,eq=brightness=-0.14[bg];` +
      `[0:v]scale=940:940:force_original_aspect_ratio=decrease[cv];` +
      `[bg][cv]overlay=(W-w)/2:(H-h)/2[base];` +
      `[1:a]showwaves=s=1080x240:mode=cline:colors=${accent}:rate=25,format=rgba,colorchannelmixer=aa=0.6[w];` +
      `[base][w]overlay=0:H-300,format=yuv420p[v]`;
    const args = [
      "-y", "-loop", "1", "-i", coverPath, "-ss", String(Math.max(0, opts?.start || 0)), "-i", audioPath,
      "-filter_complex", fc, "-map", "[v]", "-map", "1:a", "-t", String(max), "-r", "25",
      "-c:v", "libx264", "-preset", "veryfast", "-pix_fmt", "yuv420p", "-c:a", "aac", "-b:a", "256k", "-shortest", "-movflags", "+faststart", outPath,
    ];
    const ff = spawn(process.env.FFMPEG_PATH || "ffmpeg", args);
    let err = ""; ff.stderr.on("data", (d) => { err += d.toString(); });
    ff.on("error", reject);
    ff.on("close", (code) => (code === 0 ? resolve() : reject(new Error("ffmpeg_failed: " + err.slice(-400)))));
  });
}

// Tid → LRC-stempel [mm:ss.xx]
const lrcStamp = (sec: number) => { const m = Math.floor(sec / 60), s = sec - m * 60; return `[${String(m).padStart(2, "0")}:${s.toFixed(2).padStart(5, "0")}]`; };

const makeInviteToken = () => "inv_" + randomUUID().replace(/-/g, "");

type AnyPool = {
  query: (text: string, params?: unknown[]) => Promise<{ rows: any[]; rowCount: number }>;
};

export interface AudioShowcaseDeps {
  app: express.Application;
  pool: AnyPool;
  requireUserSession: (req: any, res: any) => { userId: string; email?: string | null; name?: string | null } | null;
  // Valgfri: send invitasjons-e-post (injiseres fra index.ts m/ Resend). Ruten
  // virker uansett — e-post hoppes over hvis ikke konfigurert.
  sendInviteEmail?: (to: string, data: { inviterName: string; projectTitle: string; inviteUrl: string }) => Promise<void>;
  // Valgfri: generell e-post (brukes til signatur-kvittering). Hoppes over hvis ikke satt.
  sendEmail?: (opts: { to: string; subject: string; html: string; text: string; kind?: string }) => Promise<void>;
  // Valgfri: hent universell business-branding (Universal Dashboard → settings)
  // slik at avtale-PDF arver produsentens logo/farge/navn automatisk.
  getBrandingForUser?: (userId: string) => Promise<{ businessName?: string; logoUrl?: string; accentColor?: string } | null>;
  // Valgfri: autorisert YouTube-klient for innlogget bruker (gjenbruker eksisterende
  // Google-tilkobling fra youtube-routes). Mangler den → publisering ikke tilgjengelig.
  getYoutubeClient?: (userId: string, req: any) => Promise<{ youtube: any } | null>;
  // Valgfri: multer (memoryStorage) for opplasting av eget Canvas-klipp.
  uploadClip?: { single: (field: string) => any };
}

const isMissingTable = (e: unknown) =>
  typeof e === "object" && e !== null && (e as { code?: string }).code === "42P01";
const str = (v: unknown, max = 2000) => (typeof v === "string" ? v.trim().slice(0, max) : "");
const num = (v: unknown): number | null => { const n = Number(v); return Number.isFinite(n) ? n : null; };

// ── Ekstern EaseVerse-bro (stabil toveis tekst-synk) ───────────────────────
const EV_URL = (process.env.EASEVERSE_API_URL || "").trim().replace(/\/+$/, "");
const EV_KEY = (process.env.EASEVERSE_API_KEY || "").trim();

type EvResult = { configured: boolean; reachable: boolean; status?: number; item?: any; latencyMs?: number; error?: string };

async function evFetch(path: string, init: RequestInit, timeoutMs = 6000): Promise<EvResult> {
  if (!EV_URL) return { configured: false, reachable: false };
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  const startedAt = Date.now();
  try {
    const headers: Record<string, string> = { ...(init.headers as Record<string, string> || {}) };
    if (EV_KEY) headers["x-api-key"] = EV_KEY;
    const r = await fetch(`${EV_URL}${path}`, { ...init, headers, signal: ctrl.signal });
    const latencyMs = Date.now() - startedAt;
    const json = await r.json().catch(() => null);
    return { configured: true, reachable: true, status: r.status, item: json?.item ?? null, latencyMs };
  } catch (e: any) {
    return { configured: true, reachable: false, error: String(e?.message || e), latencyMs: Date.now() - startedAt };
  } finally {
    clearTimeout(timer);
  }
}

// Hent tekst fra EaseVerse med 1 retry på nettverks-/5xx-feil (ikke 4xx).
async function evGetLyrics(externalTrackId: string): Promise<EvResult> {
  let last: EvResult = { configured: Boolean(EV_URL), reachable: false };
  for (let attempt = 0; attempt < 2; attempt++) {
    const res = await evFetch(`/api/v1/collab/lyrics/${encodeURIComponent(externalTrackId)}`, { method: "GET" });
    if (!res.configured) return res;
    last = res;
    if (res.reachable && res.status && (res.status < 500 || res.status === 404)) return res; // 2xx/4xx er endelig
  }
  return last;
}

async function evPushLyrics(payload: Record<string, unknown>): Promise<EvResult> {
  return evFetch(`/api/v1/collab/lyrics`, {
    method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(payload),
  });
}

// Hent DAW-markører (Pro Tools-seksjoner) fra EaseVerse for en track.
async function evGetProtools(externalTrackId: string): Promise<EvResult> {
  for (let attempt = 0; attempt < 2; attempt++) {
    const res = await evFetch(`/api/v1/collab/protools/${encodeURIComponent(externalTrackId)}`, { method: "GET" });
    if (!res.configured) return res;
    if (res.reachable && res.status && (res.status < 500 || res.status === 404)) return res;
  }
  return { configured: Boolean(process.env.EASEVERSE_API_URL), reachable: false };
}

// Hent keeper-takes (vokalopptak) fra EaseVerse for en track (liste-respons).
async function evGetTakes(externalTrackId: string): Promise<{ configured: boolean; reachable: boolean; items: any[] }> {
  if (!EV_URL) return { configured: false, reachable: false, items: [] };
  const ctrl = new AbortController(); const timer = setTimeout(() => ctrl.abort(), 8000);
  try {
    const headers: Record<string, string> = {}; if (EV_KEY) headers["x-api-key"] = EV_KEY;
    const r = await fetch(`${EV_URL}/api/v1/collab/takes/${encodeURIComponent(externalTrackId)}`, { headers, signal: ctrl.signal });
    const j = await r.json().catch(() => null);
    return { configured: true, reachable: r.ok, items: Array.isArray(j?.items) ? j.items : [] };
  } catch { return { configured: true, reachable: false, items: [] }; }
  finally { clearTimeout(timer); }
}

// Enkel in-memory rate-limiter (sliding window) for offentlige token-endepunkter.
const rateBuckets = new Map<string, number[]>();
function rateLimited(key: string, max = 30, windowMs = 60_000): boolean {
  const now = Date.now();
  const arr = (rateBuckets.get(key) || []).filter((t) => now - t < windowMs);
  arr.push(now);
  rateBuckets.set(key, arr);
  return arr.length > max;
}
const clientIp = (req: any): string => (req.headers?.["x-forwarded-for"]?.split(",")[0]?.trim() || req.ip || req.socket?.remoteAddress || "?");

// Honeypot: skjult felt mennesker aldri fyller ut. Er det utfylt → bot/spam.
// Vi svarer «ok» uten å lagre noe, så boten ikke skjønner at den ble stoppet.
const isHoneypot = (req: any): boolean => {
  const v = req.body?.company_website ?? req.body?.hp_field;
  return typeof v === "string" && v.trim().length > 0;
};

// ── Spotify (Client Credentials, server-til-server, token-cachet) ──────────
// Kun lese-tilgang (søk/artist/album/track + ISRC/UPC-oppslag). Kan IKKE
// laste opp musikk — det gjør distributøren. Token caches til ~utløp.
let spotifyTok: { value: string; exp: number } | null = null;
async function spotifyToken(): Promise<string | null> {
  const id = process.env.SPOTIFY_CLIENT_ID, secret = process.env.SPOTIFY_CLIENT_SECRET;
  if (!id || !secret) return null;
  if (spotifyTok && spotifyTok.exp > Date.now() + 30_000) return spotifyTok.value;
  try {
    const r = await fetch("https://accounts.spotify.com/api/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded", Authorization: "Basic " + Buffer.from(`${id}:${secret}`).toString("base64") },
      body: "grant_type=client_credentials",
    });
    if (!r.ok) return null;
    const j: any = await r.json();
    if (!j?.access_token) return null;
    spotifyTok = { value: j.access_token, exp: Date.now() + (Number(j.expires_in) || 3600) * 1000 };
    return spotifyTok.value;
  } catch { return null; }
}
async function spotifyGet(path: string): Promise<any | null> {
  const tok = await spotifyToken(); if (!tok) return null;
  try { const r = await fetch(`https://api.spotify.com/v1${path}`, { headers: { Authorization: `Bearer ${tok}` } }); if (!r.ok) return null; return await r.json(); } catch { return null; }
}
const spotifyArtistDTO = (a: any) => ({ id: a.id, name: a.name, url: a.external_urls?.spotify || null, image: a.images?.[a.images.length - 1]?.url || a.images?.[0]?.url || null, genres: a.genres || [], followers: a.followers?.total ?? null, popularity: a.popularity ?? null });

// Seksjons-farge per markør-type (matcher frontend SECTION_COLORS-spekteret).
const PT_SECTION_COLOR: Record<string, string> = {
  intro: "#d6457f", verse: "#3fa7d6", "pre-chorus": "#8aa0b6", chorus: "#FF6B35",
  bridge: "#e0a955", "final-chorus": "#e0606a", outro: "#5fb88a",
};

export function setupAudioShowcaseRoutes(deps: AudioShowcaseDeps): void {
  const { app, pool, requireUserSession, sendInviteEmail, sendEmail, getBrandingForUser, getYoutubeClient, uploadClip } = deps;
  const APP_URL = (process.env.PUBLIC_APP_URL || "https://creatorhubn.com").replace(/\/+$/, "");

  // Send invitasjons-e-post (fire-and-forget) hvis dep + e-post finnes.
  async function emailInvite(memberId: string, projectId: string, ownerName: string): Promise<boolean> {
    if (!sendInviteEmail) return false;
    const r = await pool.query(
      `SELECT m.email, m.invite_token, p.title FROM audio_review_members m JOIN audio_review_projects p ON p.id = m.project_id
        WHERE m.id = $1::uuid LIMIT 1`, [memberId]).catch(() => ({ rows: [] as any[] }));
    const row = r.rows[0];
    if (!row?.email || !row?.invite_token) return false;
    try { await sendInviteEmail(row.email, { inviterName: ownerName || "Produsenten", projectTitle: row.title || "et prosjekt", inviteUrl: `${APP_URL}/audio-review/invite/${row.invite_token}` }); return true; }
    catch { return false; }
  }

  // Hent koblet track + lokal tekst-tilstand for et review-rom.
  async function loadLinkedTrack(reviewId: string, userId: string): Promise<any | null> {
    const p = await pool.query(
      `SELECT easeverse_track_id, external_track_id FROM audio_review_projects
        WHERE id = $1::uuid AND owner_user_id = $2 LIMIT 1`, [reviewId, userId]);
    if (p.rowCount === 0) return { notFound: true };
    const trackId = p.rows[0].easeverse_track_id;
    const externalTrackId = p.rows[0].external_track_id || trackId;
    if (!trackId) return null;
    const t = await pool.query(
      `SELECT id, title, artist, bpm, collaborators, lyrics,
              COALESCE(lyrics_updated_at, updated_at) AS lyrics_updated_at
         FROM easeverse_tracks WHERE id = $1::uuid AND user_id = $2 LIMIT 1`, [trackId, userId]);
    if (t.rowCount === 0) return null;
    return { ...t.rows[0], externalTrackId };
  }

  // Sjekk at en versjon tilhører innlogget eier (for moderering/godkjenning).
  async function ownsVersion(versionId: string, userId: string): Promise<boolean> {
    const r = await pool.query(
      `SELECT 1 FROM audio_review_versions v JOIN audio_review_projects p ON p.id = v.project_id
        WHERE v.id = $1::uuid AND p.owner_user_id = $2 LIMIT 1`,
      [versionId, userId],
    );
    return r.rowCount > 0;
  }

  // ── Prosjekt ────────────────────────────────────────────────────────────
  app.post("/api/audio-showcases", async (req, res) => {
    const s = requireUserSession(req, res); if (!s) return;
    const title = str(req.body?.title, 200);
    if (!title) return res.status(400).json({ error: "title_required" });
    try {
      const r = await pool.query(
        `INSERT INTO audio_review_projects (owner_user_id, showcase_id, title, artist_name, band_name, genre, bpm, musical_key, deadline, easeverse_track_id, external_track_id)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING *`,
        [s.userId, str(req.body?.showcaseId, 200) || null, title, str(req.body?.artistName, 200) || null,
         str(req.body?.bandName, 200) || null, str(req.body?.genre, 120) || null, num(req.body?.bpm),
         str(req.body?.musicalKey, 40) || null, str(req.body?.deadline, 40) || null,
         str(req.body?.easeverseTrackId, 64) || null, str(req.body?.externalTrackId, 200) || null],
      );
      return res.status(201).json(r.rows[0]);
    } catch (e) {
      if (isMissingTable(e)) return res.status(503).json({ error: "migration_pending" });
      console.error("[audio-showcase] create project failed:", e);
      return res.status(500).json({ error: "create_failed" });
    }
  });

  app.get("/api/audio-showcases", async (req, res) => {
    const s = requireUserSession(req, res); if (!s) return;
    try {
      const r = await pool.query(
        `SELECT * FROM audio_review_projects WHERE owner_user_id = $1 ORDER BY created_at DESC LIMIT 200`,
        [s.userId],
      );
      return res.json({ projects: r.rows });
    } catch (e) {
      if (isMissingTable(e)) return res.json({ projects: [] });
      return res.status(500).json({ error: "list_failed" });
    }
  });

  app.get("/api/audio-showcases/:id", async (req, res) => {
    const s = requireUserSession(req, res); if (!s) return;
    const id = str(req.params.id, 64);
    try {
      const p = await pool.query(
        `SELECT * FROM audio_review_projects WHERE id = $1::uuid AND owner_user_id = $2 LIMIT 1`, [id, s.userId]);
      if (p.rowCount === 0) return res.status(404).json({ error: "not_found" });
      const [v, members, tasks] = await Promise.all([
        pool.query(`SELECT * FROM audio_review_versions WHERE project_id = $1::uuid ORDER BY version_number ASC`, [id]),
        pool.query(`SELECT * FROM audio_review_members WHERE project_id = $1::uuid ORDER BY is_owner DESC, order_index ASC, created_at ASC`, [id]).catch(() => ({ rows: [] })),
        pool.query(`SELECT * FROM audio_review_tasks WHERE project_id = $1::uuid ORDER BY order_index ASC, created_at ASC`, [id]).catch(() => ({ rows: [] })),
      ]);
      // Koblet SongFlow/EaseVerse-track → tekst + track-status inn i studioet.
      let easeverseTrack: any = null;
      const linkedTrackId = p.rows[0].easeverse_track_id;
      if (linkedTrackId) {
        const t = await pool.query(
          `SELECT id, title, artist, status, lyrics FROM easeverse_tracks WHERE id = $1::uuid LIMIT 1`, [linkedTrackId],
        ).catch(() => ({ rows: [] as any[] }));
        easeverseTrack = t.rows[0] || null;
      }
      return res.json({ project: p.rows[0], versions: v.rows, members: members.rows, tasks: tasks.rows, easeverseTrack });
    } catch (e) {
      if (isMissingTable(e)) return res.status(404).json({ error: "not_found" });
      return res.status(500).json({ error: "get_failed" });
    }
  });

  // ── Versjon (bounce) ──────────────────────────────────────────────────────
  app.post("/api/audio-versions", async (req, res) => {
    const s = requireUserSession(req, res); if (!s) return;
    const projectId = str(req.body?.projectId, 64);
    const fileUrl = str(req.body?.fileUrl, 1000);
    if (!projectId || !fileUrl) return res.status(400).json({ error: "projectId_and_fileUrl_required" });
    try {
      const owns = await pool.query(
        `SELECT 1 FROM audio_review_projects WHERE id = $1::uuid AND owner_user_id = $2 LIMIT 1`, [projectId, s.userId]);
      if (owns.rowCount === 0) return res.status(404).json({ error: "project_not_found" });

      // §14 — kun én current review-versjon: sett tidligere under_review → superseded.
      await pool.query(
        `UPDATE audio_review_versions SET status = 'superseded'
          WHERE project_id = $1::uuid AND status = 'under_review'`, [projectId]);
      const nextNo = await pool.query(
        `SELECT COALESCE(MAX(version_number),0)+1 AS n FROM audio_review_versions WHERE project_id = $1::uuid`, [projectId]);
      const vn = nextNo.rows[0].n;
      const r = await pool.query(
        `INSERT INTO audio_review_versions
           (project_id, version_label, version_number, file_name, file_url, preview_url, duration, sample_rate, bit_depth, channels, codec, file_size, uploaded_by)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13) RETURNING *`,
        [projectId, str(req.body?.versionLabel, 80) || `Mix V${vn}`, vn, str(req.body?.fileName, 300) || null, fileUrl,
         str(req.body?.previewUrl, 1000) || null, num(req.body?.duration), num(req.body?.sampleRate), num(req.body?.bitDepth),
         num(req.body?.channels), str(req.body?.codec, 40) || null, num(req.body?.fileSize), s.userId],
      );
      await pool.query(`UPDATE audio_review_projects SET status='under_review', updated_at=NOW() WHERE id=$1::uuid`, [projectId]);
      return res.status(201).json(r.rows[0]);
    } catch (e) {
      if (isMissingTable(e)) return res.status(503).json({ error: "migration_pending" });
      console.error("[audio-showcase] create version failed:", e);
      return res.status(500).json({ error: "create_version_failed" });
    }
  });

  app.get("/api/audio-versions/:id", async (req, res) => {
    const s = requireUserSession(req, res); if (!s) return;
    const id = str(req.params.id, 64);
    try {
      const v = await pool.query(`SELECT * FROM audio_review_versions WHERE id = $1::uuid LIMIT 1`, [id]);
      if (v.rowCount === 0) return res.status(404).json({ error: "not_found" });
      const [comments, sections, approvals] = await Promise.all([
        pool.query(`SELECT * FROM audio_review_comments WHERE version_id = $1::uuid ORDER BY timecode_seconds ASC, created_at ASC`, [id]),
        pool.query(`SELECT * FROM audio_review_sections WHERE version_id = $1::uuid ORDER BY order_index ASC, start_time_seconds ASC`, [id]),
        pool.query(`SELECT * FROM audio_review_approvals WHERE version_id = $1::uuid ORDER BY created_at DESC`, [id]),
      ]);
      return res.json({ version: v.rows[0], comments: comments.rows, sections: sections.rows, approvals: approvals.rows });
    } catch (e) {
      if (isMissingTable(e)) return res.status(404).json({ error: "not_found" });
      return res.status(500).json({ error: "get_version_failed" });
    }
  });

  // ── Kommentar (tidskodet) ────────────────────────────────────────────────
  app.post("/api/audio-comments", async (req, res) => {
    const s = requireUserSession(req, res); if (!s) return;
    const versionId = str(req.body?.versionId, 64);
    const body = str(req.body?.body ?? req.body?.comment, 4000);
    if (!versionId || !body) return res.status(400).json({ error: "versionId_and_body_required" });
    try {
      const r = await pool.query(
        `INSERT INTO audio_review_comments
           (version_id, parent_comment_id, user_id, author, author_role, timecode_seconds, body, category, is_decision, section_ref)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *`,
        [versionId, str(req.body?.parentCommentId, 64) || null, s.userId, str(req.body?.author, 200) || s.name || s.email || "Bruker",
         str(req.body?.authorRole, 80) || null, num(req.body?.timecodeSeconds) ?? num(req.body?.timecode) ?? 0, body,
         str(req.body?.category, 40) || "general", Boolean(req.body?.isDecision), str(req.body?.sectionRef, 120) || null],
      );
      return res.status(201).json(r.rows[0]);
    } catch (e) {
      if (isMissingTable(e)) return res.status(503).json({ error: "migration_pending" });
      console.error("[audio-showcase] create comment failed:", e);
      return res.status(500).json({ error: "create_comment_failed" });
    }
  });

  app.patch("/api/audio-comments/:id", async (req, res) => {
    const s = requireUserSession(req, res); if (!s) return;
    const id = str(req.params.id, 64);
    const sets: string[] = ["updated_at = NOW()"]; const params: unknown[] = [id];
    if (typeof req.body?.status === "string") {
      const st = str(req.body.status, 20);
      if (!["unresolved", "in_progress", "resolved", "decision", "rejected"].includes(st))
        return res.status(400).json({ error: "invalid_status" });
      params.push(st); sets.push(`status = $${params.length}`);
      params.push(st === "decision"); sets.push(`is_decision = $${params.length}`);
    }
    if (typeof req.body?.body === "string") { params.push(str(req.body.body, 4000)); sets.push(`body = $${params.length}`); }
    if (params.length === 1) return res.status(400).json({ error: "nothing_to_update" });
    try {
      const r = await pool.query(`UPDATE audio_review_comments SET ${sets.join(", ")} WHERE id = $1::uuid RETURNING *`, params);
      if (r.rowCount === 0) return res.status(404).json({ error: "not_found" });
      return res.json(r.rows[0]);
    } catch (e) {
      if (isMissingTable(e)) return res.status(503).json({ error: "migration_pending" });
      return res.status(500).json({ error: "update_comment_failed" });
    }
  });

  // ── Seksjoner (låtstruktur, §16) ──────────────────────────────────────────
  app.post("/api/audio-versions/:id/sections", async (req, res) => {
    const s = requireUserSession(req, res); if (!s) return;
    const versionId = str(req.params.id, 64);
    const sections = Array.isArray(req.body?.sections) ? req.body.sections : [];
    if (!sections.length) return res.status(400).json({ error: "sections_required" });
    try {
      if (!(await ownsVersion(versionId, s.userId))) return res.status(404).json({ error: "not_found" });
      await pool.query(`DELETE FROM audio_review_sections WHERE version_id = $1::uuid`, [versionId]);
      let i = 0;
      for (const sec of sections) {
        await pool.query(
          `INSERT INTO audio_review_sections (version_id, name, start_time_seconds, end_time_seconds, color, order_index)
           VALUES ($1,$2,$3,$4,$5,$6)`,
          [versionId, str(sec?.name, 80) || `Del ${i + 1}`, num(sec?.startTimeSeconds) ?? 0, num(sec?.endTimeSeconds) ?? 0, str(sec?.color, 40) || null, i++],
        );
      }
      const r = await pool.query(`SELECT * FROM audio_review_sections WHERE version_id = $1::uuid ORDER BY order_index ASC`, [versionId]);
      return res.json({ sections: r.rows });
    } catch (e) {
      if (isMissingTable(e)) return res.status(503).json({ error: "migration_pending" });
      return res.status(500).json({ error: "sections_failed" });
    }
  });

  // ── Godkjenning (§19) ─────────────────────────────────────────────────────
  app.post("/api/audio-versions/:id/approve", async (req, res) => {
    const s = requireUserSession(req, res); if (!s) return;
    const versionId = str(req.params.id, 64);
    const approvalType = str(req.body?.approvalType, 40) || "mix_approved";
    if (!["mix_approved", "master_approved", "delivery_approved", "changes_requested"].includes(approvalType))
      return res.status(400).json({ error: "invalid_approval_type" });
    try {
      if (!(await ownsVersion(versionId, s.userId))) return res.status(404).json({ error: "not_found" });
      const a = await pool.query(
        `INSERT INTO audio_review_approvals (version_id, approved_by, approval_type, note) VALUES ($1,$2,$3,$4) RETURNING *`,
        [versionId, s.name || s.userId, approvalType, str(req.body?.note, 1000) || null]);
      // Versjon- + prosjekt-status følger godkjenningen.
      const vStatus = approvalType === "changes_requested" ? "under_review" : "approved";
      await pool.query(`UPDATE audio_review_versions SET status = $2 WHERE id = $1::uuid`, [versionId, vStatus]);
      const pStatus = approvalType === "changes_requested" ? "changes_requested"
        : approvalType === "delivery_approved" ? "final_delivered" : "approved";
      await pool.query(
        `UPDATE audio_review_projects SET status = $2, updated_at = NOW()
          WHERE id = (SELECT project_id FROM audio_review_versions WHERE id = $1::uuid)`, [versionId, pStatus]);
      // Synk koblet SongFlow/EaseVerse-track-status (mix_approved→mastering, delivery→completed, changes→mixing).
      const trackStatus = approvalType === "changes_requested" ? "mixing"
        : approvalType === "delivery_approved" ? "completed"
        : approvalType === "master_approved" ? "completed" : "mastering";
      await pool.query(
        `UPDATE easeverse_tracks SET status = $2, updated_at = NOW()
          WHERE id = (SELECT easeverse_track_id FROM audio_review_projects
                      WHERE id = (SELECT project_id FROM audio_review_versions WHERE id = $1::uuid))::uuid`,
        [versionId, trackStatus]).catch(() => { /* ikke koblet / annen DB-state */ });
      return res.status(201).json(a.rows[0]);
    } catch (e) {
      if (isMissingTable(e)) return res.status(503).json({ error: "migration_pending" });
      console.error("[audio-showcase] approve failed:", e);
      return res.status(500).json({ error: "approve_failed" });
    }
  });

  // ── Leveranser (§18) ──────────────────────────────────────────────────────
  app.get("/api/audio-showcases/:id/deliverables", async (req, res) => {
    const s = requireUserSession(req, res); if (!s) return;
    const projectId = str(req.params.id, 64);
    try {
      const owns = await pool.query(`SELECT 1 FROM audio_review_projects WHERE id=$1::uuid AND owner_user_id=$2 LIMIT 1`, [projectId, s.userId]);
      if (owns.rowCount === 0) return res.status(404).json({ error: "not_found" });
      const r = await pool.query(`SELECT * FROM audio_review_deliverables WHERE project_id=$1::uuid ORDER BY created_at DESC`, [projectId]);
      return res.json({ deliverables: r.rows });
    } catch (e) {
      if (isMissingTable(e)) return res.json({ deliverables: [] });
      return res.status(500).json({ error: "list_deliverables_failed" });
    }
  });

  app.post("/api/audio-deliverables", async (req, res) => {
    const s = requireUserSession(req, res); if (!s) return;
    const projectId = str(req.body?.projectId, 64);
    const fileUrl = str(req.body?.fileUrl, 1000);
    if (!projectId || !fileUrl) return res.status(400).json({ error: "projectId_and_fileUrl_required" });
    try {
      const owns = await pool.query(`SELECT 1 FROM audio_review_projects WHERE id=$1::uuid AND owner_user_id=$2 LIMIT 1`, [projectId, s.userId]);
      if (owns.rowCount === 0) return res.status(404).json({ error: "project_not_found" });
      const r = await pool.query(
        `INSERT INTO audio_review_deliverables (project_id, version_id, type, file_name, file_url, file_size, format, downloadable)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
        [projectId, str(req.body?.versionId, 64) || null, str(req.body?.type, 60) || null, str(req.body?.fileName, 300) || null,
         fileUrl, num(req.body?.fileSize), str(req.body?.format, 40) || null, Boolean(req.body?.downloadable)]);
      return res.status(201).json(r.rows[0]);
    } catch (e) {
      if (isMissingTable(e)) return res.status(503).json({ error: "migration_pending" });
      return res.status(500).json({ error: "create_deliverable_failed" });
    }
  });

  // ── Kommentar-reaksjon (👍) ───────────────────────────────────────────────
  app.post("/api/audio-comments/:id/like", async (req, res) => {
    const s = requireUserSession(req, res); if (!s) return;
    const id = str(req.params.id, 64);
    const dir = num(req.body?.delta) === -1 ? -1 : 1;
    try {
      const r = await pool.query(
        `UPDATE audio_review_comments SET like_count = GREATEST(0, like_count + $2), updated_at = NOW()
          WHERE id = $1::uuid RETURNING *`, [id, dir]);
      if (r.rowCount === 0) return res.status(404).json({ error: "not_found" });
      return res.json(r.rows[0]);
    } catch (e) {
      if (isMissingTable(e)) return res.status(503).json({ error: "migration_pending" });
      return res.status(500).json({ error: "like_failed" });
    }
  });

  // ── Prosjektmedlemmer (band/crew) ─────────────────────────────────────────
  const PALETTE = ["#FF6B35", "#9b59b6", "#3fa7d6", "#e0a955", "#5fb88a", "#e0606a", "#8aa0b6"];
  app.get("/api/audio-showcases/:id/members", async (req, res) => {
    const s = requireUserSession(req, res); if (!s) return;
    const id = str(req.params.id, 64);
    try {
      const owns = await pool.query(`SELECT 1 FROM audio_review_projects WHERE id=$1::uuid AND owner_user_id=$2 LIMIT 1`, [id, s.userId]);
      if (owns.rowCount === 0) return res.status(404).json({ error: "not_found" });
      const r = await pool.query(`SELECT * FROM audio_review_members WHERE project_id=$1::uuid ORDER BY is_owner DESC, order_index ASC, created_at ASC`, [id]);
      return res.json({ members: r.rows });
    } catch (e) {
      if (isMissingTable(e)) return res.json({ members: [] });
      return res.status(500).json({ error: "list_members_failed" });
    }
  });

  app.post("/api/audio-showcases/:id/members", async (req, res) => {
    const s = requireUserSession(req, res); if (!s) return;
    const id = str(req.params.id, 64);
    const name = str(req.body?.name, 200);
    if (!name) return res.status(400).json({ error: "name_required" });
    try {
      const owns = await pool.query(`SELECT 1 FROM audio_review_projects WHERE id=$1::uuid AND owner_user_id=$2 LIMIT 1`, [id, s.userId]);
      if (owns.rowCount === 0) return res.status(404).json({ error: "not_found" });
      const cnt = await pool.query(`SELECT COUNT(*)::int AS n FROM audio_review_members WHERE project_id=$1::uuid`, [id]);
      const n = cnt.rows[0].n;
      const isOwner = Boolean(req.body?.isOwner);
      const token = isOwner ? null : makeInviteToken();
      const r = await pool.query(
        `INSERT INTO audio_review_members
           (project_id, user_id, name, role, avatar_color, is_owner, order_index, email, instrument, invite_token, invite_status, invited_at, invite_expires_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11, CASE WHEN $10::text IS NULL THEN NULL ELSE NOW() END, CASE WHEN $10::text IS NULL THEN NULL ELSE NOW() + INTERVAL '90 days' END) RETURNING *`,
        [id, str(req.body?.userId, 200) || null, name, str(req.body?.role, 80) || null,
         str(req.body?.avatarColor, 40) || PALETTE[n % PALETTE.length], isOwner, n,
         str(req.body?.email, 200) || null, str(req.body?.instrument, 120) || null, token, isOwner ? "owner" : "pending"]);
      const created = r.rows[0];
      let emailed = false;
      if (token && created.email) emailed = await emailInvite(created.id, id, s.name || "").catch(() => false);
      return res.status(201).json({ ...created, inviteToken: token, inviteUrl: token ? `/audio-review/invite/${token}` : null, emailed });
    } catch (e) {
      if (isMissingTable(e)) return res.status(503).json({ error: "migration_pending" });
      return res.status(500).json({ error: "add_member_failed" });
    }
  });

  // Send (eller send på nytt) invitasjons-e-post til et medlem.
  app.post("/api/audio-members/:id/resend-invite", async (req, res) => {
    const s = requireUserSession(req, res); if (!s) return;
    const id = str(req.params.id, 64);
    try {
      const m = await pool.query(
        `SELECT m.project_id, m.email FROM audio_review_members m
          WHERE m.id=$1::uuid AND m.project_id IN (SELECT id FROM audio_review_projects WHERE owner_user_id=$2) LIMIT 1`, [id, s.userId]);
      if (m.rowCount === 0) return res.status(404).json({ error: "not_found" });
      if (!m.rows[0].email) return res.status(409).json({ error: "no_email", message: "Medlemmet mangler e-postadresse." });
      if (!sendInviteEmail) return res.status(503).json({ error: "email_not_configured" });
      const ok = await emailInvite(id, m.rows[0].project_id, s.name || "");
      return res.json({ ok, emailed: ok });
    } catch (e) {
      return res.status(500).json({ error: "resend_failed" });
    }
  });

  app.delete("/api/audio-members/:id", async (req, res) => {
    const s = requireUserSession(req, res); if (!s) return;
    const id = str(req.params.id, 64);
    try {
      const r = await pool.query(
        `DELETE FROM audio_review_members WHERE id=$1::uuid AND project_id IN
           (SELECT id FROM audio_review_projects WHERE owner_user_id=$2) RETURNING id`, [id, s.userId]);
      if (r.rowCount === 0) return res.status(404).json({ error: "not_found" });
      return res.json({ ok: true });
    } catch (e) {
      if (isMissingTable(e)) return res.status(503).json({ error: "migration_pending" });
      return res.status(500).json({ error: "delete_member_failed" });
    }
  });

  // Produsent fyller ut / redigerer en bidragsyters profil (auth, kun eier).
  const PROFILE_FIELDS: Array<[string, string, number]> = [
    ["name", "name", 200], ["role", "role", 80], ["instrument", "instrument", 120],
    ["email", "email", 200], ["phone", "phone", 60], ["bio", "bio", 2000], ["avatarColor", "avatar_color", 40], ["avatarUrl", "avatar_url", 3_000_000],
  ];
  app.patch("/api/audio-members/:id", async (req, res) => {
    const s = requireUserSession(req, res); if (!s) return;
    const id = str(req.params.id, 64);
    const sets: string[] = []; const params: unknown[] = [id, s.userId];
    for (const [body, col, max] of PROFILE_FIELDS) {
      if (typeof req.body?.[body] === "string") { params.push(str(req.body[body], max)); sets.push(`${col} = $${params.length}`); }
    }
    if (typeof req.body?.easeverseAccess === "boolean") { params.push(req.body.easeverseAccess); sets.push(`easeverse_access = $${params.length}`); }
    if (req.body?.links && typeof req.body.links === "object") { params.push(JSON.stringify(req.body.links).slice(0, 4000)); sets.push(`links = $${params.length}::jsonb`); }
    if (Array.isArray(req.body?.contributions)) { params.push(JSON.stringify(req.body.contributions.filter((x: unknown) => typeof x === "string").slice(0, 30))); sets.push(`contributions = $${params.length}::jsonb`); }
    if (!sets.length) return res.status(400).json({ error: "nothing_to_update" });
    sets.push("invite_status = CASE WHEN invite_status = 'pending' THEN 'active' ELSE invite_status END");
    sets.push("profile_completed_at = COALESCE(profile_completed_at, NOW())");
    try {
      const r = await pool.query(
        `UPDATE audio_review_members SET ${sets.join(", ")}
          WHERE id = $1::uuid AND project_id IN (SELECT id FROM audio_review_projects WHERE owner_user_id = $2) RETURNING *`, params);
      if (r.rowCount === 0) return res.status(404).json({ error: "not_found" });
      return res.json(r.rows[0]);
    } catch (e) {
      if (isMissingTable(e)) return res.status(503).json({ error: "migration_pending" });
      return res.status(500).json({ error: "update_member_failed" });
    }
  });

  // ── Offentlig invitasjon: bidragsyter åpner lenke + fyller ut profil ──────
  app.get("/api/audio-review-invite/:token", async (req, res) => {
    const token = str(req.params.token, 80);
    if (!token.startsWith("inv_")) return res.status(400).json({ error: "invalid_token" });
    try {
      const r = await pool.query(
        `SELECT m.id, m.name, m.role, m.instrument, m.email, m.phone, m.bio, m.avatar_color, m.avatar_url, m.invite_status,
                m.easeverse_access, m.links, m.contributions, m.profile_completed_at, p.title AS project_title, p.band_name,
                COALESCE(p.external_track_id, p.easeverse_track_id) AS external_track_id,
                (SELECT name FROM audio_review_members WHERE project_id = m.project_id AND is_owner = TRUE LIMIT 1) AS inviter_name
           FROM audio_review_members m JOIN audio_review_projects p ON p.id = m.project_id
          WHERE m.invite_token = $1 AND (m.invite_expires_at IS NULL OR m.invite_expires_at > NOW()) LIMIT 1`, [token]);
      if (r.rowCount === 0) return res.status(404).json({ error: "not_found" });
      return res.json(r.rows[0]);
    } catch (e) {
      if (isMissingTable(e)) return res.status(404).json({ error: "not_found" });
      return res.status(500).json({ error: "invite_lookup_failed" });
    }
  });

  app.post("/api/audio-review-invite/:token", async (req, res) => {
    const token = str(req.params.token, 80);
    if (!token.startsWith("inv_")) return res.status(400).json({ error: "invalid_token" });
    if (isHoneypot(req)) return res.json({ ok: true });
    if (rateLimited(`inv:${clientIp(req)}`)) return res.status(429).json({ error: "rate_limited" });
    const name = str(req.body?.name, 200);
    if (!name) return res.status(400).json({ error: "name_required" });
    try {
      const r = await pool.query(
        `UPDATE audio_review_members SET name = $2, role = COALESCE($3, role), instrument = $4, email = $5, phone = $6, bio = $7,
           avatar_url = COALESCE($8, avatar_url), easeverse_access = COALESCE($9, easeverse_access), links = COALESCE($10::jsonb, links),
           contributions = COALESCE($11::jsonb, contributions), invite_status = 'active', profile_completed_at = NOW()
          WHERE invite_token = $1 AND (invite_expires_at IS NULL OR invite_expires_at > NOW()) RETURNING id, name, role, instrument, invite_status, easeverse_access`,
        [token, name, str(req.body?.role, 80) || null, str(req.body?.instrument, 120) || null,
         str(req.body?.email, 200) || null, str(req.body?.phone, 60) || null, str(req.body?.bio, 2000) || null,
         str(req.body?.avatarUrl, 3000000) || null, typeof req.body?.easeverseAccess === "boolean" ? req.body.easeverseAccess : null,
         req.body?.links && typeof req.body.links === "object" ? JSON.stringify(req.body.links).slice(0, 4000) : null,
         Array.isArray(req.body?.contributions) ? JSON.stringify(req.body.contributions.filter((x: unknown) => typeof x === "string").slice(0, 30)) : null]);
      if (r.rowCount === 0) return res.status(404).json({ error: "not_found" });
      return res.json({ ok: true, member: r.rows[0] });
    } catch (e) {
      if (isMissingTable(e)) return res.status(503).json({ error: "migration_pending" });
      return res.status(500).json({ error: "complete_profile_failed" });
    }
  });

  // ── Tasks (spec: oppgaver i stedet for AI) ────────────────────────────────
  app.get("/api/audio-showcases/:id/tasks", async (req, res) => {
    const s = requireUserSession(req, res); if (!s) return;
    const id = str(req.params.id, 64);
    try {
      const owns = await pool.query(`SELECT 1 FROM audio_review_projects WHERE id=$1::uuid AND owner_user_id=$2 LIMIT 1`, [id, s.userId]);
      if (owns.rowCount === 0) return res.status(404).json({ error: "not_found" });
      const r = await pool.query(`SELECT * FROM audio_review_tasks WHERE project_id=$1::uuid ORDER BY order_index ASC, created_at ASC`, [id]);
      return res.json({ tasks: r.rows });
    } catch (e) {
      if (isMissingTable(e)) return res.json({ tasks: [] });
      return res.status(500).json({ error: "list_tasks_failed" });
    }
  });

  app.post("/api/audio-tasks", async (req, res) => {
    const s = requireUserSession(req, res); if (!s) return;
    const projectId = str(req.body?.projectId, 64);
    const title = str(req.body?.title, 400);
    if (!projectId || !title) return res.status(400).json({ error: "projectId_and_title_required" });
    try {
      const owns = await pool.query(`SELECT 1 FROM audio_review_projects WHERE id=$1::uuid AND owner_user_id=$2 LIMIT 1`, [projectId, s.userId]);
      if (owns.rowCount === 0) return res.status(404).json({ error: "project_not_found" });
      const cnt = await pool.query(`SELECT COUNT(*)::int AS n FROM audio_review_tasks WHERE project_id=$1::uuid`, [projectId]);
      const r = await pool.query(
        `INSERT INTO audio_review_tasks (project_id, version_id, comment_id, title, status, assignee, created_by, order_index)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
        [projectId, str(req.body?.versionId, 64) || null, str(req.body?.commentId, 64) || null, title,
         str(req.body?.status, 20) || "todo", str(req.body?.assignee, 200) || str(req.body?.category, 80) || null,
         s.name || s.userId, cnt.rows[0].n]);
      return res.status(201).json(r.rows[0]);
    } catch (e) {
      if (isMissingTable(e)) return res.status(503).json({ error: "migration_pending" });
      return res.status(500).json({ error: "create_task_failed" });
    }
  });

  app.patch("/api/audio-tasks/:id", async (req, res) => {
    const s = requireUserSession(req, res); if (!s) return;
    const id = str(req.params.id, 64);
    const sets: string[] = ["updated_at = NOW()"]; const params: unknown[] = [id];
    if (typeof req.body?.status === "string") {
      const st = str(req.body.status, 20);
      if (!["todo", "in_progress", "done"].includes(st)) return res.status(400).json({ error: "invalid_status" });
      params.push(st); sets.push(`status = $${params.length}`);
    }
    if (typeof req.body?.title === "string") { params.push(str(req.body.title, 400)); sets.push(`title = $${params.length}`); }
    if (typeof req.body?.assignee === "string") { params.push(str(req.body.assignee, 200)); sets.push(`assignee = $${params.length}`); }
    if (params.length === 1) return res.status(400).json({ error: "nothing_to_update" });
    try {
      const r = await pool.query(
        `UPDATE audio_review_tasks SET ${sets.join(", ")} WHERE id = $1::uuid AND project_id IN
           (SELECT id FROM audio_review_projects WHERE owner_user_id = $${params.push(s.userId)}) RETURNING *`, params);
      if (r.rowCount === 0) return res.status(404).json({ error: "not_found" });
      return res.json(r.rows[0]);
    } catch (e) {
      if (isMissingTable(e)) return res.status(503).json({ error: "migration_pending" });
      return res.status(500).json({ error: "update_task_failed" });
    }
  });

  // ── SongFlow/EaseVerse-track → Audio Showcase review-rom (Fase 1) ──────────
  // Idempotent: én aktiv review per track. Forhåndsutfyller fra track-meta +
  // collaborators → medlemmer. Tekst leses live fra easeverse_tracks (egen GET).
  app.post("/api/easeverse-tracks/:trackId/send-to-review", async (req, res) => {
    const s = requireUserSession(req, res); if (!s) return;
    const trackId = str(req.params.trackId, 64);
    try {
      const t = await pool.query(
        `SELECT * FROM easeverse_tracks WHERE id = $1::uuid AND user_id = $2 LIMIT 1`, [trackId, s.userId]);
      if (t.rowCount === 0) return res.status(404).json({ error: "track_not_found" });
      const track = t.rows[0];

      // Finn eksisterende review for denne tracken (idempotent).
      const existing = await pool.query(
        `SELECT id FROM audio_review_projects WHERE easeverse_track_id = $1 AND owner_user_id = $2
           AND status <> 'archived' ORDER BY created_at DESC LIMIT 1`, [trackId, s.userId]);
      if (existing.rowCount > 0) {
        return res.json({ reviewProjectId: existing.rows[0].id, created: false });
      }

      const keyMap: Record<string, string> = {};
      const created = await pool.query(
        `INSERT INTO audio_review_projects
           (owner_user_id, title, artist_name, band_name, genre, bpm, musical_key, status, easeverse_track_id, external_track_id)
         VALUES ($1,$2,$3,$4,$5,$6,$7,'draft',$8,$8) RETURNING id`,
        [s.userId, track.title || "Uten tittel", track.artist || null, track.artist || null,
         track.genre || null, track.bpm || null, track.musical_key || null, trackId]);
      const reviewId = created.rows[0].id;

      // Eier (produsent) + collaborators → medlemmer (idempotent på navn).
      const PALETTE = ["#FF6B35", "#9b59b6", "#3fa7d6", "#e0a955", "#5fb88a", "#e0606a", "#8aa0b6"];
      const collaborators: string[] = Array.isArray(track.collaborators)
        ? track.collaborators
        : (() => { try { return JSON.parse(track.collaborators || "[]"); } catch { return []; } })();
      const names = [{ name: s.name || "Produsent", role: "Produsent", owner: true }];
      collaborators.forEach((c) => { const nm = String(c).trim(); if (nm) names.push({ name: nm, role: "Bidragsyter", owner: false }); });
      let i = 0;
      for (const m of names) {
        const token = m.owner ? null : makeInviteToken();
        await pool.query(
          `INSERT INTO audio_review_members (project_id, name, role, avatar_color, is_owner, order_index, invite_token, invite_status, invited_at, invite_expires_at)
           SELECT $1::uuid,$2,$3,$4,$5,$6,$7,$8, CASE WHEN $7::text IS NULL THEN NULL ELSE NOW() END, CASE WHEN $7::text IS NULL THEN NULL ELSE NOW() + INTERVAL '90 days' END
            WHERE NOT EXISTS (SELECT 1 FROM audio_review_members WHERE project_id = $1::uuid AND name = $2)`,
          [reviewId, m.name, m.role, PALETTE[i % PALETTE.length], m.owner, i, token, m.owner ? "owner" : "pending"]); i++;
      }
      keyMap; // (reservert for fremtidig seksjons-map)
      return res.status(201).json({ reviewProjectId: reviewId, created: true });
    } catch (e) {
      if (isMissingTable(e)) return res.status(503).json({ error: "migration_pending" });
      console.error("[audio-showcase] send-to-review failed:", e);
      return res.status(500).json({ error: "send_to_review_failed" });
    }
  });

  // ── Rediger tekst fra studioet → lokal + push til EaseVerse (toveis) ───────
  app.put("/api/audio-showcases/:id/lyrics", async (req, res) => {
    const s = requireUserSession(req, res); if (!s) return;
    const id = str(req.params.id, 64);
    const lyrics = typeof req.body?.lyrics === "string" ? req.body.lyrics : null;
    if (lyrics === null) return res.status(400).json({ error: "lyrics_required" });
    try {
      const track = await loadLinkedTrack(id, s.userId);
      if (track?.notFound) return res.status(404).json({ error: "not_found" });
      if (!track) return res.status(409).json({ error: "no_linked_track" });
      const r = await pool.query(
        `UPDATE easeverse_tracks SET lyrics = $2, lyrics_updated_at = NOW(), updated_at = NOW()
           WHERE id = $1::uuid AND user_id = $3 RETURNING lyrics, lyrics_updated_at`,
        [track.id, lyrics.slice(0, 20000), s.userId]);
      if (r.rowCount === 0) return res.status(404).json({ error: "track_not_found" });
      const updatedAt = new Date(r.rows[0].lyrics_updated_at).toISOString();
      // Push til EaseVerse (toveis). Blokkerer ikke svaret på ekstern feil.
      const collaborators = Array.isArray(track.collaborators) ? track.collaborators
        : (() => { try { return JSON.parse(track.collaborators || "[]"); } catch { return []; } })();
      const push = await evPushLyrics({
        externalTrackId: track.externalTrackId, title: track.title || "Uten tittel",
        artist: track.artist || undefined, bpm: track.bpm || undefined,
        lyrics: lyrics.slice(0, 20000), collaborators, source: "creatorhub", updatedAt,
      });
      return res.json({
        ok: true, lyrics: r.rows[0].lyrics, updatedAt,
        connection: { easeverseConfigured: push.configured, reachable: push.reachable, latencyMs: push.latencyMs ?? null },
      });
    } catch (e) {
      if (isMissingTable(e)) return res.status(503).json({ error: "migration_pending" });
      return res.status(500).json({ error: "update_lyrics_failed" });
    }
  });

  // ── Synk-status: lokal tekst + EaseVerse-tilkobling + om ekstern er nyere ──
  app.get("/api/audio-showcases/:id/lyrics-sync", async (req, res) => {
    const s = requireUserSession(req, res); if (!s) return;
    const id = str(req.params.id, 64);
    try {
      const track = await loadLinkedTrack(id, s.userId);
      if (track?.notFound) return res.status(404).json({ error: "not_found" });
      if (!track) return res.json({ linked: false, connection: { easeverseConfigured: Boolean(EV_URL), reachable: false } });
      const localUpdatedAt = track.lyrics_updated_at ? new Date(track.lyrics_updated_at).toISOString() : null;
      const remote = await evGetLyrics(track.externalTrackId);
      const remoteUpdatedAt = remote.item?.updatedAt || null;
      const remoteNewer = Boolean(remoteUpdatedAt && (!localUpdatedAt || Date.parse(remoteUpdatedAt) > Date.parse(localUpdatedAt)));
      return res.json({
        linked: true, lyrics: track.lyrics || "", updatedAt: localUpdatedAt, title: track.title,
        connection: { easeverseConfigured: remote.configured, reachable: remote.reachable, latencyMs: remote.latencyMs ?? null, lastCheckedAt: new Date().toISOString() },
        remote: { present: Boolean(remote.item), updatedAt: remoteUpdatedAt, newer: remoteNewer },
      });
    } catch (e) {
      if (isMissingTable(e)) return res.status(503).json({ error: "migration_pending" });
      return res.status(500).json({ error: "lyrics_sync_status_failed" });
    }
  });

  // ── Reconcile nå (last-write-wins): pull hvis ekstern nyere, ellers push ───
  app.post("/api/audio-showcases/:id/lyrics-sync", async (req, res) => {
    const s = requireUserSession(req, res); if (!s) return;
    const id = str(req.params.id, 64);
    try {
      const track = await loadLinkedTrack(id, s.userId);
      if (track?.notFound) return res.status(404).json({ error: "not_found" });
      if (!track) return res.status(409).json({ error: "no_linked_track" });
      const localUpdatedAt = track.lyrics_updated_at ? new Date(track.lyrics_updated_at).toISOString() : null;
      const remote = await evGetLyrics(track.externalTrackId);
      const remoteUpdatedAt = remote.item?.updatedAt || null;
      const collaborators = Array.isArray(track.collaborators) ? track.collaborators
        : (() => { try { return JSON.parse(track.collaborators || "[]"); } catch { return []; } })();

      if (remote.configured && !remote.reachable) {
        return res.json({ applied: "offline", lyrics: track.lyrics || "", updatedAt: localUpdatedAt,
          connection: { easeverseConfigured: true, reachable: false, latencyMs: remote.latencyMs ?? null } });
      }
      // Ekstern nyere → pull inn lokalt.
      if (remoteUpdatedAt && (!localUpdatedAt || Date.parse(remoteUpdatedAt) > Date.parse(localUpdatedAt))) {
        const r = await pool.query(
          `UPDATE easeverse_tracks SET lyrics = $2, lyrics_updated_at = $3::timestamptz, updated_at = NOW()
             WHERE id = $1::uuid AND user_id = $4 RETURNING lyrics, lyrics_updated_at`,
          [track.id, String(remote.item.lyrics || "").slice(0, 20000), remoteUpdatedAt, s.userId]);
        return res.json({ applied: "pulled", lyrics: r.rows[0].lyrics, updatedAt: new Date(r.rows[0].lyrics_updated_at).toISOString(),
          connection: { easeverseConfigured: true, reachable: true, latencyMs: remote.latencyMs ?? null } });
      }
      // Lokal nyere / ekstern mangler → push ut.
      const push = await evPushLyrics({
        externalTrackId: track.externalTrackId, title: track.title || "Uten tittel", artist: track.artist || undefined,
        bpm: track.bpm || undefined, lyrics: String(track.lyrics || ""), collaborators, source: "creatorhub",
        updatedAt: localUpdatedAt || new Date().toISOString(),
      });
      return res.json({ applied: push.reachable ? "pushed" : "offline", lyrics: track.lyrics || "", updatedAt: localUpdatedAt,
        connection: { easeverseConfigured: push.configured, reachable: push.reachable, latencyMs: push.latencyMs ?? null } });
    } catch (e) {
      if (isMissingTable(e)) return res.status(503).json({ error: "migration_pending" });
      return res.status(500).json({ error: "lyrics_sync_failed" });
    }
  });

  // ── Live tekst-strøm (SSE) — auto-reconnect, heartbeat, graceful offline ───
  app.get("/api/audio-showcases/:id/lyrics-stream", async (req, res) => {
    // EventSource kan ikke sette headere → token via query.
    const qToken = typeof req.query.token === "string" ? req.query.token : "";
    const authedReq = qToken ? { ...req, headers: { ...req.headers, authorization: `Bearer ${qToken}` } } : req;
    const s = requireUserSession(authedReq as any, res); if (!s) return;
    const id = str(req.params.id, 64);
    const track = await loadLinkedTrack(id, s.userId).catch(() => null);
    if (!track || track.notFound) { res.status(404).json({ error: "not_found" }); return; }

    res.writeHead(200, {
      "Content-Type": "text/event-stream", "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive", "X-Accel-Buffering": "no",
    });
    const send = (event: string, data: unknown) => { try { res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`); } catch { /* socket lukket */ } };

    let lastUpdatedAt = track.lyrics_updated_at ? new Date(track.lyrics_updated_at).toISOString() : null;
    send("snapshot", { lyrics: track.lyrics || "", updatedAt: lastUpdatedAt, title: track.title });

    let closed = false;
    const poll = async () => {
      if (closed) return;
      try {
        const t = await loadLinkedTrack(id, s.userId);
        if (!t || t.notFound) return;
        const remote = await evGetLyrics(t.externalTrackId);
        if (!remote.configured) { send("status", { easeverseConfigured: false, reachable: false }); return; }
        if (!remote.reachable) { send("status", { easeverseConfigured: true, reachable: false }); return; }
        const remoteUpdatedAt = remote.item?.updatedAt || null;
        const localUpdatedAt = t.lyrics_updated_at ? new Date(t.lyrics_updated_at).toISOString() : null;
        // Ekstern nyere → pull inn lokalt + push til klient.
        if (remoteUpdatedAt && (!localUpdatedAt || Date.parse(remoteUpdatedAt) > Date.parse(localUpdatedAt))) {
          await pool.query(
            `UPDATE easeverse_tracks SET lyrics = $2, lyrics_updated_at = $3::timestamptz, updated_at = NOW() WHERE id = $1::uuid AND user_id = $4`,
            [t.id, String(remote.item.lyrics || "").slice(0, 20000), remoteUpdatedAt, s.userId]).catch(() => {});
          lastUpdatedAt = remoteUpdatedAt;
          send("update", { lyrics: String(remote.item.lyrics || ""), updatedAt: remoteUpdatedAt, source: "easeverse", reachable: true });
        } else {
          send("status", { easeverseConfigured: true, reachable: true });
        }
      } catch { send("status", { easeverseConfigured: Boolean(EV_URL), reachable: false }); }
    };
    const pollTimer = setInterval(() => { void poll(); }, 4000);
    const beat = setInterval(() => send("ping", { t: Date.now() }), 15000);
    void poll();
    req.on("close", () => { closed = true; clearInterval(pollTimer); clearInterval(beat); try { res.end(); } catch { /* */ } });
  });

  // ── Prosjekt-redigering (cover-bilde + meta) ──────────────────────────────
  app.patch("/api/audio-showcases/:id", async (req, res) => {
    const s = requireUserSession(req, res); if (!s) return;
    const id = str(req.params.id, 64);
    const map: Array<[string, string, number]> = [
      ["coverUrl", "cover_url", 3_000_000], ["title", "title", 200], ["bandName", "band_name", 200],
      ["artistName", "artist_name", 200], ["genre", "genre", 120], ["musicalKey", "musical_key", 40],
    ];
    const sets: string[] = ["updated_at = NOW()"]; const params: unknown[] = [id, s.userId];
    for (const [body, col, max] of map) {
      if (typeof req.body?.[body] === "string") { params.push(str(req.body[body], max)); sets.push(`${col} = $${params.length}`); }
    }
    if (typeof req.body?.bpm !== "undefined") { params.push(num(req.body.bpm)); sets.push(`bpm = $${params.length}`); }
    if (params.length === 2) return res.status(400).json({ error: "nothing_to_update" });
    try {
      const r = await pool.query(
        `UPDATE audio_review_projects SET ${sets.join(", ")} WHERE id = $1::uuid AND owner_user_id = $2 RETURNING *`, params);
      if (r.rowCount === 0) return res.status(404).json({ error: "not_found" });
      return res.json(r.rows[0]);
    } catch (e) {
      if (isMissingTable(e)) return res.status(503).json({ error: "migration_pending" });
      return res.status(500).json({ error: "update_project_failed" });
    }
  });

  // ── Profil → Split Sheet: generer royalty-splitt fra review-medlemmene ─────
  // Les koblet splittark + parter (for redigering i studioet).
  app.get("/api/audio-showcases/:id/split-sheet", async (req, res) => {
    const s = requireUserSession(req, res); if (!s) return;
    const id = str(req.params.id, 64);
    try {
      const ss = await pool.query(
        `SELECT id, status, total_percentage FROM split_sheets WHERE user_id=$1 AND metadata->>'sourceReviewId'=$2 LIMIT 1`, [s.userId, id]);
      if (ss.rowCount === 0) return res.json({ exists: false });
      const c = await pool.query(
        `SELECT id, name, email, role, percentage, signed_at, custom_fields FROM split_sheet_contributors WHERE split_sheet_id=$1 ORDER BY order_index ASC`, [ss.rows[0].id]);
      const signedCount = c.rows.filter((r) => r.signed_at).length;
      return res.json({ exists: true, splitSheetId: ss.rows[0].id, status: ss.rows[0].status, totalPercentage: Number(ss.rows[0].total_percentage),
        contributors: c.rows, signedCount, allSigned: signedCount === c.rowCount && c.rowCount > 0, url: `/crm?splitSheet=${ss.rows[0].id}` });
    } catch (e) {
      if (isMissingTable(e)) return res.json({ exists: false });
      return res.status(500).json({ error: "split_sheet_read_failed" });
    }
  });

  // Oppdater avtale-vilkår (master/komposisjon-royalty + sats) på koblet splittark.
  // Master-% = split_sheet_contributors.percentage (trigger 0–100); komposisjon
  // + honorar lagres i custom_fields. Låst hvis noen har signert.
  app.patch("/api/audio-showcases/:id/split-sheet", async (req, res) => {
    const s = requireUserSession(req, res); if (!s) return;
    const id = str(req.params.id, 64);
    const splits: any[] = Array.isArray(req.body?.contributors) ? req.body.contributors : [];
    if (!splits.length) return res.status(400).json({ error: "contributors_required" });
    try {
      const ss = await pool.query(
        `SELECT id FROM split_sheets WHERE user_id=$1 AND metadata->>'sourceReviewId'=$2 LIMIT 1`, [s.userId, id]);
      if (ss.rowCount === 0) return res.status(404).json({ error: "not_found" });
      const ssId = ss.rows[0].id;
      // Lås: kan ikke endre vilkår etter at noen har signert (juridisk integritet).
      const signed = await pool.query(`SELECT COUNT(*)::int AS n FROM split_sheet_contributors WHERE split_sheet_id=$1 AND signed_at IS NOT NULL`, [ssId]);
      if (signed.rows[0].n > 0) return res.status(409).json({ error: "locked_signed", message: "Avtalen er signert av minst én part og er låst. Lås opp for å endre (krever ny signering)." });

      const clean = splits.map((c) => ({
        id: str(c.id, 64),
        master: Math.max(0, Math.min(100, Number(c.masterPct ?? c.percentage) || 0)),
        comp: Math.max(0, Math.min(100, Number(c.compositionPct) || 0)),
        feeAmount: Number(c.feeAmount) > 0 ? Number(c.feeAmount) : null,
        feeCurrency: str(c.feeCurrency, 8) || "NOK",
        feeType: ["royalty", "session", "buyout", "hourly"].includes(c.feeType) ? c.feeType : "royalty",
      }));
      const masterTotal = Math.round(clean.reduce((a, c) => a + c.master, 0) * 100) / 100;
      const compTotal = Math.round(clean.reduce((a, c) => a + c.comp, 0) * 100) / 100;
      if (masterTotal > 100.01) return res.status(400).json({ error: "master_exceeds_100", total: masterTotal });
      await pool.query(`UPDATE split_sheet_contributors SET percentage=0 WHERE split_sheet_id=$1::uuid`, [ssId]);
      for (const c of clean) {
        await pool.query(
          `UPDATE split_sheet_contributors
             SET percentage=$2, updated_at=NOW(),
                 custom_fields = COALESCE(custom_fields,'{}'::jsonb) || $4::jsonb
           WHERE id=$1::uuid AND split_sheet_id=$3::uuid`,
          [c.id, c.master, ssId, JSON.stringify({ compositionPct: c.comp, feeAmount: c.feeAmount, feeCurrency: c.feeCurrency, feeType: c.feeType })]);
      }
      return res.json({ ok: true, masterTotal, compTotal, masterBalanced: Math.abs(masterTotal - 100) < 0.01, compBalanced: Math.abs(compTotal - 100) < 0.01 });
    } catch (e) {
      if (isMissingTable(e)) return res.status(503).json({ error: "migration_pending" });
      console.error("[audio-showcase] split-sheet patch failed:", e);
      return res.status(500).json({ error: "split_sheet_update_failed" });
    }
  });

  // Lås opp (fjern alle signaturer) for å kunne endre vilkår på nytt.
  app.post("/api/audio-showcases/:id/split-sheet/unlock", async (req, res) => {
    const s = requireUserSession(req, res); if (!s) return;
    const id = str(req.params.id, 64);
    try {
      const ss = await pool.query(`SELECT id FROM split_sheets WHERE user_id=$1 AND metadata->>'sourceReviewId'=$2 LIMIT 1`, [s.userId, id]);
      if (ss.rowCount === 0) return res.status(404).json({ error: "not_found" });
      await pool.query(`UPDATE split_sheet_contributors SET signed_at=NULL, signature_data=NULL, updated_at=NOW() WHERE split_sheet_id=$1`, [ss.rows[0].id]);
      await pool.query(`UPDATE split_sheets SET status='draft', updated_at=NOW() WHERE id=$1`, [ss.rows[0].id]);
      return res.json({ ok: true });
    } catch (e) {
      return res.status(500).json({ error: "unlock_failed" });
    }
  });

  // Juridisk signering av en part: samtykke + revisjonslogg (IP/tid) + snapshot
  // av nøyaktig hva som ble signert. Setter status når alle har signert.
  async function signContributor(ssId: string, contributorId: string, signerName: string, ip: string, ua: string, opts?: { signatureImage?: string; method?: string }): Promise<any | null> {
    const cur = await pool.query(`SELECT id, name, email, percentage, custom_fields, signed_at FROM split_sheet_contributors WHERE id=$1::uuid AND split_sheet_id=$2::uuid LIMIT 1`, [contributorId, ssId]);
    if (cur.rowCount === 0) return null;
    const c = cur.rows[0];
    // Allerede signert → idempotent: ikke overskriv, bare bekreft.
    if (c.signed_at) {
      const cnt = await pool.query(`SELECT COUNT(*)::int total, COUNT(signed_at)::int signed FROM split_sheet_contributors WHERE split_sheet_id=$1`, [ssId]);
      return { id: c.id, name: c.name, signed_at: c.signed_at, alreadySigned: true, allSigned: cnt.rows[0].signed >= cnt.rows[0].total };
    }
    const snapshot = { contributorId: c.id, name: c.name, masterPct: Number(c.percentage), compositionPct: c.custom_fields?.compositionPct ?? null, feeAmount: c.custom_fields?.feeAmount ?? null, feeCurrency: c.custom_fields?.feeCurrency ?? null, feeType: c.custom_fields?.feeType ?? null, contributions: c.custom_fields?.contributions ?? [] };
    const at = new Date().toISOString();
    // Bare PNG data-URL aksepteres som signaturbilde (tegnet/typografert på klient), maks ~200KB.
    const sigImg = typeof opts?.signatureImage === "string" && /^data:image\/png;base64,/.test(opts.signatureImage) && opts.signatureImage.length < 280_000 ? opts.signatureImage : null;
    const method = opts?.method === "drawn" ? "drawn_electronic_signature" : opts?.method === "typed" ? "typed_electronic_signature" : "simple_electronic_signature";
    // Integritets-hash (tamper-evidens): SHA-256 av nøyaktig signerte vilkår + signatar + tid.
    const signatureHash = createHash("sha256").update(JSON.stringify({ snapshot, signerName, at })).digest("hex");
    const sig = { name: signerName, consent: true, at, ip, userAgent: (ua || "").slice(0, 300), method, signatureImage: sigImg, signatureHash, snapshot };
    const r = await pool.query(`UPDATE split_sheet_contributors SET signed_at=NOW(), signature_data=$3::jsonb, updated_at=NOW() WHERE id=$1::uuid AND split_sheet_id=$2::uuid RETURNING id, name, signed_at`, [contributorId, ssId, JSON.stringify(sig)]);
    // Sett status når alle har signert.
    const counts = await pool.query(`SELECT COUNT(*)::int total, COUNT(signed_at)::int signed FROM split_sheet_contributors WHERE split_sheet_id=$1`, [ssId]);
    const { total, signed } = counts.rows[0];
    await pool.query(`UPDATE split_sheets SET status=$2, updated_at=NOW() WHERE id=$1`, [ssId, signed >= total ? "completed" : "pending_signatures"]);
    // Kvittering til signataren (fire-and-forget) — etterprøvbart bevis på signaturen.
    if (sendEmail && c.email) void sendSignatureReceipt(ssId, c.email, signerName, sig).catch(() => {});
    return { ...r.rows[0], allSigned: signed >= total };
  }

  // Send signatur-kvittering med nøyaktig signerte vilkår + integritetshash.
  async function sendSignatureReceipt(ssId: string, to: string, signerName: string, sig: any): Promise<void> {
    if (!sendEmail) return;
    const ssRow = await pool.query(`SELECT title FROM split_sheets WHERE id=$1 LIMIT 1`, [ssId]).catch(() => ({ rows: [] as any[] }));
    const title = ssRow.rows[0]?.title || "avtale";
    const s = sig.snapshot || {};
    const fee = Number(s.feeAmount) > 0 ? `${s.feeAmount} ${s.feeCurrency || "NOK"}` : "—";
    const when = new Date(sig.at).toLocaleString("no-NO");
    const subject = `Kvittering: du har signert «${title}»`;
    const html = `<div style="font-family:system-ui,Arial,sans-serif;max-width:560px;margin:0 auto;color:#1a1a1a">
      <h2 style="margin:0 0 4px">Signatur bekreftet</h2>
      <p style="margin:0 0 16px;color:#555">Dette bekrefter at <strong>${signerName}</strong> har signert avtalen for <strong>«${title}»</strong>.</p>
      <table style="border-collapse:collapse;width:100%;font-size:14px">
        <tr><td style="padding:6px 0;color:#888">Master-andel</td><td style="text-align:right;font-weight:600">${s.masterPct ?? 0}%</td></tr>
        <tr><td style="padding:6px 0;color:#888">Komposisjon</td><td style="text-align:right;font-weight:600">${s.compositionPct ?? 0}%</td></tr>
        <tr><td style="padding:6px 0;color:#888">Honorar</td><td style="text-align:right;font-weight:600">${fee}</td></tr>
        ${(s.contributions || []).length ? `<tr><td style="padding:6px 0;color:#888">Bidrag</td><td style="text-align:right;font-weight:600">${s.contributions.join(", ")}</td></tr>` : ""}
        <tr><td style="padding:6px 0;color:#888">Signert</td><td style="text-align:right">${when}</td></tr>
      </table>
      <p style="margin:16px 0 0;padding:10px 12px;background:#f5f5f7;border-radius:8px;color:#666;font-size:12px">
        Elektronisk signatur (enkel). Integritetskontroll (SHA-256):<br><code style="word-break:break-all">${sig.signatureHash}</code>
      </p>
      <p style="margin:12px 0 0;color:#888;font-size:12px">Ta vare på denne e-posten som kvittering. Endres vilkårene må alle signere på nytt.</p></div>`;
    const text = `Signatur bekreftet. ${signerName} har signert «${title}».\nMaster ${s.masterPct ?? 0}% · Komposisjon ${s.compositionPct ?? 0}% · Honorar ${fee}\nSignert: ${when}\nIntegritetskontroll (SHA-256): ${sig.signatureHash}`;
    await sendEmail({ to, subject, html, text, kind: "audio_split_signature_receipt" });
  }

  app.post("/api/audio-showcases/:id/split-sheet/sign", async (req, res) => {
    const s = requireUserSession(req, res); if (!s) return;
    const id = str(req.params.id, 64);
    const contributorId = str(req.body?.contributorId, 64);
    const signature = str(req.body?.signature, 200);
    if (!contributorId || !signature) return res.status(400).json({ error: "contributorId_and_signature_required" });
    if (req.body?.consent !== true) return res.status(400).json({ error: "consent_required" });
    try {
      const ss = await pool.query(`SELECT id FROM split_sheets WHERE user_id=$1 AND metadata->>'sourceReviewId'=$2 LIMIT 1`, [s.userId, id]);
      if (ss.rowCount === 0) return res.status(404).json({ error: "not_found" });
      const out = await signContributor(ss.rows[0].id, contributorId, signature, clientIp(req), String(req.headers["user-agent"] || ""), { signatureImage: req.body?.signatureImage, method: str(req.body?.signatureMethod, 12) });
      if (!out) return res.status(404).json({ error: "contributor_not_found" });
      return res.json({ ok: true, signed: out });
    } catch (e) {
      if (isMissingTable(e)) return res.status(503).json({ error: "migration_pending" });
      return res.status(500).json({ error: "sign_failed" });
    }
  });

  app.post("/api/audio-showcases/:id/split-sheet", async (req, res) => {
    const s = requireUserSession(req, res); if (!s) return;
    const id = str(req.params.id, 64);
    try {
      const p = await pool.query(
        `SELECT id, title, easeverse_track_id FROM audio_review_projects WHERE id=$1::uuid AND owner_user_id=$2 LIMIT 1`, [id, s.userId]);
      if (p.rowCount === 0) return res.status(404).json({ error: "not_found" });
      const project = p.rows[0];
      const m = await pool.query(
        `SELECT name, email, role, contributions FROM audio_review_members WHERE project_id=$1::uuid ORDER BY is_owner DESC, order_index ASC`, [id]);
      const members = m.rows;
      if (members.length === 0) return res.status(409).json({ error: "no_members" });

      // Idempotent: gjenbruk eksisterende split sheet for denne reviewen.
      const existing = await pool.query(
        `SELECT id FROM split_sheets WHERE user_id=$1 AND metadata->>'sourceReviewId'=$2 LIMIT 1`, [s.userId, id]).catch(() => ({ rows: [] as any[] }));
      if (existing.rows && existing.rows.length) return res.json({ splitSheetId: existing.rows[0].id, created: false, url: `/crm?splitSheet=${existing.rows[0].id}` });

      // Lik fordeling, rest til første.
      const base = Math.floor((10000 / members.length)) / 100; // 2 desimaler
      const pcts = members.map(() => base);
      pcts[0] = Math.round((100 - base * (members.length - 1)) * 100) / 100;

      // Map fri-tekst medlems-rolle → gyldig split_sheet_contributors-rolle.
      const mapRole = (r: string): string => {
        const x = (r || "").toLowerCase();
        if (/produsent|producer/.test(x)) return "producer";
        if (/vokal|vocal|sang/.test(x)) return "vocalist";
        if (/tekst|lyric/.test(x)) return "lyricist";
        if (/kompon|compos/.test(x)) return "composer";
        if (/mastering|master\b/.test(x)) return "mastering_engineer";
        if (/mix/.test(x)) return "mix_engineer";
        if (/arrang/.test(x)) return "arranger";
        if (/gitar|bass|trommer|instrument|guitar|drum|piano|keys|synth/.test(x)) return "instrumentalist";
        if (/manager|label/.test(x)) return "label";
        if (/artist/.test(x)) return "artist";
        return "collaborator";
      };
      const ssId = randomUUID();
      await pool.query(
        `INSERT INTO split_sheets (id, user_id, project_id, track_id, title, description, status, total_percentage, metadata)
         VALUES ($1,$2,$3,$4,$5,$6,'draft',100,$7::jsonb)`,
        [ssId, s.userId, null, project.easeverse_track_id || null, `${project.title} — splittark`,
         "Generert fra Audio Showcase review-medlemmer", JSON.stringify({ sourceReviewId: id })]);
      let i = 0;
      for (const mem of members) {
        await pool.query(
          `INSERT INTO split_sheet_contributors (id, split_sheet_id, name, email, role, percentage, order_index, user_id, custom_fields)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9::jsonb)`,
          [randomUUID(), ssId, mem.name, mem.email || null, mapRole(mem.role), pcts[i], i, null,
           JSON.stringify({ memberRole: mem.role || null, contributions: Array.isArray(mem.contributions) ? mem.contributions : [] })]); i++;
      }
      return res.status(201).json({ splitSheetId: ssId, created: true, contributors: members.length, url: `/crm?splitSheet=${ssId}` });
    } catch (e) {
      if (isMissingTable(e)) return res.status(503).json({ error: "migration_pending" });
      console.error("[audio-showcase] split-sheet gen failed:", e);
      return res.status(500).json({ error: "split_sheet_failed" });
    }
  });

  // ── DAW-markører fra EaseVerse → seksjoner på en versjon (Fase 2) ─────────
  app.post("/api/audio-versions/:id/pull-sections", async (req, res) => {
    const s = requireUserSession(req, res); if (!s) return;
    const versionId = str(req.params.id, 64);
    try {
      const own = await pool.query(
        `SELECT v.id, v.duration, p.external_track_id, p.easeverse_track_id
           FROM audio_review_versions v JOIN audio_review_projects p ON p.id = v.project_id
          WHERE v.id = $1::uuid AND p.owner_user_id = $2 LIMIT 1`, [versionId, s.userId]);
      if (own.rowCount === 0) return res.status(404).json({ error: "not_found" });
      const extId = own.rows[0].external_track_id || own.rows[0].easeverse_track_id;
      if (!extId) return res.status(409).json({ error: "no_linked_track" });
      const remote = await evGetProtools(extId);
      if (!remote.configured) return res.status(503).json({ error: "easeverse_not_configured" });
      if (!remote.reachable) return res.status(502).json({ error: "easeverse_unreachable" });
      const markers: any[] = Array.isArray(remote.item?.markers) ? remote.item.markers : [];
      if (!markers.length) return res.json({ applied: "no_markers", sections: [] });
      const sorted = [...markers].filter((m) => Number.isFinite(Number(m?.positionMs))).sort((a, b) => a.positionMs - b.positionMs);
      const dur = Number(own.rows[0].duration) || (sorted.length ? sorted[sorted.length - 1].positionMs / 1000 + 30 : 0);
      await pool.query(`DELETE FROM audio_review_sections WHERE version_id = $1::uuid`, [versionId]);
      let i = 0;
      for (const m of sorted) {
        const startSec = Number(m.positionMs) / 1000;
        const endSec = i < sorted.length - 1 ? Number(sorted[i + 1].positionMs) / 1000 : dur;
        const type = String(m.sectionType || "").toLowerCase();
        await pool.query(
          `INSERT INTO audio_review_sections (version_id, name, start_time_seconds, end_time_seconds, color, order_index)
           VALUES ($1::uuid,$2,$3,$4,$5,$6)`,
          [versionId, str(m.label, 80) || `Del ${i + 1}`, startSec, endSec, PT_SECTION_COLOR[type] || null, i]); i++;
      }
      const out = await pool.query(`SELECT * FROM audio_review_sections WHERE version_id = $1::uuid ORDER BY order_index ASC`, [versionId]);
      return res.json({ applied: "pulled", count: out.rowCount, sections: out.rows });
    } catch (e) {
      if (isMissingTable(e)) return res.status(503).json({ error: "migration_pending" });
      console.error("[audio-showcase] pull-sections failed:", e);
      return res.status(500).json({ error: "pull_sections_failed" });
    }
  });

  // ── EaseVerse keeper-takes → review-versjoner (Fase 2 / gap #9) ───────────
  app.post("/api/audio-showcases/:id/pull-takes", async (req, res) => {
    const s = requireUserSession(req, res); if (!s) return;
    const id = str(req.params.id, 64);
    try {
      const p = await pool.query(
        `SELECT external_track_id, easeverse_track_id FROM audio_review_projects WHERE id=$1::uuid AND owner_user_id=$2 LIMIT 1`, [id, s.userId]);
      if (p.rowCount === 0) return res.status(404).json({ error: "not_found" });
      const extId = p.rows[0].external_track_id || p.rows[0].easeverse_track_id;
      if (!extId) return res.status(409).json({ error: "no_linked_track" });
      const remote = await evGetTakes(extId);
      if (!remote.configured) return res.status(503).json({ error: "easeverse_not_configured" });
      if (!remote.reachable) return res.status(502).json({ error: "easeverse_unreachable" });
      const takes = remote.items.filter((t) => t?.url);
      if (!takes.length) return res.json({ applied: "no_takes", created: 0 });
      // Hvilke take-URL-er finnes allerede som versjoner? (idempotent)
      const existing = await pool.query(`SELECT file_url FROM audio_review_versions WHERE project_id=$1::uuid`, [id]);
      const have = new Set(existing.rows.map((r) => r.file_url));
      let created = 0;
      for (const t of takes) {
        if (have.has(t.url)) continue;
        // §14 supersede: tidligere under_review → superseded
        await pool.query(`UPDATE audio_review_versions SET status='superseded' WHERE project_id=$1::uuid AND status='under_review'`, [id]);
        const vn = await pool.query(`SELECT COALESCE(MAX(version_number),0)+1 AS n FROM audio_review_versions WHERE project_id=$1::uuid`, [id]);
        await pool.query(
          `INSERT INTO audio_review_versions (project_id, version_label, version_number, file_name, file_url, uploaded_by)
           VALUES ($1::uuid,$2,$3,$4,$5,$6)`,
          [id, `Vokal-take ${vn.rows[0].n}`, vn.rows[0].n, str(t.filename, 300) || "take.wav", t.url, "EaseVerse"]);
        created++;
      }
      if (created > 0) await pool.query(`UPDATE audio_review_projects SET status='under_review', updated_at=NOW() WHERE id=$1::uuid`, [id]);
      return res.json({ applied: created > 0 ? "pulled" : "up_to_date", created, totalTakes: takes.length });
    } catch (e) {
      if (isMissingTable(e)) return res.status(503).json({ error: "migration_pending" });
      console.error("[audio-showcase] pull-takes failed:", e);
      return res.status(500).json({ error: "pull_takes_failed" });
    }
  });

  // ── Member-tilgang via invite-token: se review + kommenter (ikke eier) ─────
  // Token = tilgang. Bidragsyteren kan se versjoner/waveform/tekst + kommentere,
  // men ikke godkjenne/laste opp/invitere.
  async function resolveSharedMember(token: string): Promise<any | null> {
    const r = await pool.query(
      `SELECT m.id AS member_id, m.name, m.role, m.project_id, p.* FROM audio_review_members m
         JOIN audio_review_projects p ON p.id = m.project_id
        WHERE m.invite_token = $1 AND (m.invite_expires_at IS NULL OR m.invite_expires_at > NOW()) LIMIT 1`, [token]);
    return r.rows[0] || null;
  }

  app.get("/api/audio-review-shared/:token", async (req, res) => {
    const token = str(req.params.token, 80);
    if (!token.startsWith("inv_")) return res.status(400).json({ error: "invalid_token" });
    try {
      const ctx = await resolveSharedMember(token);
      if (!ctx) return res.status(404).json({ error: "not_found" });
      const [v, members, tasks] = await Promise.all([
        pool.query(`SELECT * FROM audio_review_versions WHERE project_id = $1::uuid ORDER BY version_number ASC`, [ctx.project_id]),
        pool.query(`SELECT id, name, role, instrument, avatar_color, avatar_url, is_owner, invite_status, contributions FROM audio_review_members WHERE project_id = $1::uuid ORDER BY is_owner DESC, order_index ASC`, [ctx.project_id]),
        pool.query(`SELECT * FROM audio_review_tasks WHERE project_id = $1::uuid ORDER BY order_index ASC`, [ctx.project_id]).catch(() => ({ rows: [] })),
      ]);
      let easeverseTrack: any = null;
      if (ctx.easeverse_track_id) {
        const t = await pool.query(`SELECT id, title, status, lyrics FROM easeverse_tracks WHERE id = $1::uuid LIMIT 1`, [ctx.easeverse_track_id]).catch(() => ({ rows: [] as any[] }));
        easeverseTrack = t.rows[0] || null;
      }
      const project = { id: ctx.id, title: ctx.title, band_name: ctx.band_name, artist_name: ctx.artist_name, genre: ctx.genre, bpm: ctx.bpm, musical_key: ctx.musical_key, status: ctx.status, cover_url: ctx.cover_url, created_at: ctx.created_at, easeverse_track_id: ctx.easeverse_track_id };
      return res.json({ project, versions: v.rows, members: members.rows, tasks: tasks.rows, easeverseTrack, viewer: { memberId: ctx.member_id, name: ctx.name, role: ctx.role }, readonly: true });
    } catch (e) {
      if (isMissingTable(e)) return res.status(404).json({ error: "not_found" });
      return res.status(500).json({ error: "shared_get_failed" });
    }
  });

  app.get("/api/audio-review-shared/:token/version/:vid", async (req, res) => {
    const token = str(req.params.token, 80); const vid = str(req.params.vid, 64);
    if (!token.startsWith("inv_")) return res.status(400).json({ error: "invalid_token" });
    try {
      const ctx = await resolveSharedMember(token);
      if (!ctx) return res.status(404).json({ error: "not_found" });
      const v = await pool.query(`SELECT * FROM audio_review_versions WHERE id = $1::uuid AND project_id = $2::uuid LIMIT 1`, [vid, ctx.project_id]);
      if (v.rowCount === 0) return res.status(404).json({ error: "version_not_found" });
      const [comments, sections] = await Promise.all([
        pool.query(`SELECT * FROM audio_review_comments WHERE version_id = $1::uuid ORDER BY timecode_seconds ASC, created_at ASC`, [vid]),
        pool.query(`SELECT * FROM audio_review_sections WHERE version_id = $1::uuid ORDER BY order_index ASC`, [vid]),
      ]);
      return res.json({ version: v.rows[0], comments: comments.rows, sections: sections.rows });
    } catch (e) {
      if (isMissingTable(e)) return res.status(404).json({ error: "not_found" });
      return res.status(500).json({ error: "shared_version_failed" });
    }
  });

  app.post("/api/audio-review-shared/:token/comments", async (req, res) => {
    const token = str(req.params.token, 80);
    if (!token.startsWith("inv_")) return res.status(400).json({ error: "invalid_token" });
    if (isHoneypot(req)) return res.json({ ok: true });
    if (rateLimited(`shc:${clientIp(req)}`)) return res.status(429).json({ error: "rate_limited" });
    const versionId = str(req.body?.versionId, 64);
    const body = str(req.body?.body, 4000);
    if (!versionId || !body) return res.status(400).json({ error: "versionId_and_body_required" });
    try {
      const ctx = await resolveSharedMember(token);
      if (!ctx) return res.status(404).json({ error: "not_found" });
      const owns = await pool.query(`SELECT 1 FROM audio_review_versions WHERE id=$1::uuid AND project_id=$2::uuid LIMIT 1`, [versionId, ctx.project_id]);
      if (owns.rowCount === 0) return res.status(404).json({ error: "version_not_found" });
      const r = await pool.query(
        `INSERT INTO audio_review_comments (version_id, user_id, author, author_role, timecode_seconds, body, category, section_ref)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
        [versionId, `member:${ctx.member_id}`, ctx.name, ctx.role, num(req.body?.timecodeSeconds) ?? 0, body,
         str(req.body?.category, 40) || "general", str(req.body?.sectionRef, 120) || null]);
      return res.status(201).json(r.rows[0]);
    } catch (e) {
      if (isMissingTable(e)) return res.status(503).json({ error: "migration_pending" });
      return res.status(500).json({ error: "shared_comment_failed" });
    }
  });

  app.post("/api/audio-review-shared/:token/comments/:id/like", async (req, res) => {
    const token = str(req.params.token, 80); const id = str(req.params.id, 64);
    if (!token.startsWith("inv_")) return res.status(400).json({ error: "invalid_token" });
    try {
      const ctx = await resolveSharedMember(token);
      if (!ctx) return res.status(404).json({ error: "not_found" });
      const r = await pool.query(
        `UPDATE audio_review_comments SET like_count = like_count + 1, updated_at = NOW()
          WHERE id = $1::uuid AND version_id IN (SELECT id FROM audio_review_versions WHERE project_id = $2::uuid) RETURNING *`, [id, ctx.project_id]);
      if (r.rowCount === 0) return res.status(404).json({ error: "not_found" });
      return res.json(r.rows[0]);
    } catch (e) {
      return res.status(500).json({ error: "shared_like_failed" });
    }
  });

  // Member: se din egen avtale-andel (vilkår) + signér den selv (juridisk).
  app.get("/api/audio-review-shared/:token/agreement", async (req, res) => {
    const token = str(req.params.token, 80);
    if (!token.startsWith("inv_")) return res.status(400).json({ error: "invalid_token" });
    try {
      const ctx = await resolveSharedMember(token);
      if (!ctx) return res.status(404).json({ error: "not_found" });
      const ss = await pool.query(`SELECT id, status FROM split_sheets WHERE metadata->>'sourceReviewId'=$1 LIMIT 1`, [ctx.project_id]);
      if (ss.rowCount === 0) return res.json({ exists: false });
      const all = await pool.query(`SELECT id, name, role, percentage, signed_at, custom_fields FROM split_sheet_contributors WHERE split_sheet_id=$1 ORDER BY order_index ASC`, [ss.rows[0].id]);
      const mine = all.rows.find((r) => r.name === ctx.name) || null;
      return res.json({ exists: true, status: ss.rows[0].status, contributors: all.rows, mine, viewer: { name: ctx.name } });
    } catch (e) {
      if (isMissingTable(e)) return res.json({ exists: false });
      return res.status(500).json({ error: "agreement_read_failed" });
    }
  });

  app.post("/api/audio-review-shared/:token/sign", async (req, res) => {
    const token = str(req.params.token, 80);
    if (!token.startsWith("inv_")) return res.status(400).json({ error: "invalid_token" });
    if (isHoneypot(req)) return res.json({ ok: true });
    if (rateLimited(`sign:${clientIp(req)}`)) return res.status(429).json({ error: "rate_limited" });
    const signature = str(req.body?.signature, 200);
    if (!signature) return res.status(400).json({ error: "signature_required" });
    if (req.body?.consent !== true) return res.status(400).json({ error: "consent_required" });
    try {
      const ctx = await resolveSharedMember(token);
      if (!ctx) return res.status(404).json({ error: "not_found" });
      const ss = await pool.query(`SELECT id FROM split_sheets WHERE metadata->>'sourceReviewId'=$1 LIMIT 1`, [ctx.project_id]);
      if (ss.rowCount === 0) return res.status(409).json({ error: "no_split_sheet" });
      const c = await pool.query(`SELECT id FROM split_sheet_contributors WHERE split_sheet_id=$1 AND name=$2 LIMIT 1`, [ss.rows[0].id, ctx.name]);
      if (c.rowCount === 0) return res.status(404).json({ error: "not_a_party" });
      const out = await signContributor(ss.rows[0].id, c.rows[0].id, signature, clientIp(req), String(req.headers["user-agent"] || ""), { signatureImage: req.body?.signatureImage, method: str(req.body?.signatureMethod, 12) });
      return res.json({ ok: true, signed: out });
    } catch (e) {
      if (isMissingTable(e)) return res.status(503).json({ error: "migration_pending" });
      return res.status(500).json({ error: "shared_sign_failed" });
    }
  });

  // ── Signert avtaledokument (PDF) — branded, profesjonelt oppsett ───────────
  const FEE_LABEL: Record<string, string> = { royalty: "Royalty", flat: "Fast honorar", hybrid: "Royalty + honorar", buyout: "Buyout", session: "Sesjonshonorar" };
  type Brand = { name: string; accent: string; logo: Buffer | null };
  function buildAgreementPdf(title: string, status: string, contributors: any[], agreementId: string, brand: Brand, cover?: Buffer | null): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({ size: "A4", margin: 0, bufferPages: true, info: { Title: `Splittavtale – ${title}`, Author: "CreatorHub" } });
      const chunks: Buffer[] = [];
      doc.on("data", (c: Buffer) => chunks.push(c));
      doc.on("end", () => resolve(Buffer.concat(chunks)));
      doc.on("error", reject);

      const F = pdfFonts();
      doc.registerFont("Sans", F.regular);
      doc.registerFont("Sans-Bold", F.bold);
      doc.registerFont("Sans-Oblique", F.oblique);

      const PW = 595.28, PH = 841.89, L = 50, R = 545, W = R - L;
      const ACCENT = brand.accent || "#FF6B35", INK = "#16110b", GREY = "#6b665e", FAINT = "#a8a298",
        LINE = "#e7e3db", CREAM = "#faf8f4", GREEN = "#1a7a4a", GREENBG = "#e8f4ee", AMBER = "#a8670a", AMBERBG = "#fbf0df", RED = "#b00020";

      const pill = (x: number, y: number, text: string, bg: string, fg: string): number => {
        doc.font("Sans-Bold").fontSize(7.5);
        const w = doc.widthOfString(text) + 16;
        doc.roundedRect(x, y, w, 15, 7.5).fill(bg);
        doc.fillColor(fg).text(text, x + 8, y + 4, { lineBreak: false });
        return w;
      };

      // ── HEADER ──
      doc.rect(0, 0, PW, 7).fill(ACCENT);
      let logoOk = false;
      if (brand.logo) { try { doc.image(brand.logo, L, 28, { fit: [34, 34], align: "left", valign: "center" }); logoOk = true; } catch { logoOk = false; } }
      if (!logoOk) { doc.roundedRect(L, 30, 30, 30, 8).fill(INK); doc.fillColor(ACCENT).font("Sans-Bold").fontSize(17).text("C", L, 38, { width: 30, align: "center" }); }
      const wordmark = brand.name || "CreatorHub";
      doc.fillColor(INK).font("Sans-Bold").fontSize(13).text(wordmark, L + 44, 34, { lineBreak: false });
      doc.fillColor(GREY).font("Sans").fontSize(9).text(brand.name ? "Audio Showcase" : "Audio Showcase", L + 44, 50, { lineBreak: false });
      doc.fillColor(FAINT).font("Sans-Bold").fontSize(8).text("AVTALEDOKUMENT", L, 36, { width: W, align: "right" });
      doc.fillColor(GREY).font("Sans").fontSize(8).text(`Ref. ${agreementId}`, L, 49, { width: W, align: "right" });

      // ── TITTEL (+ cover-bilde av låta hvis det finnes) ──
      let y = 92;
      let coverOk = false;
      if (cover) { try { doc.save(); doc.roundedRect(R - 62, y - 2, 62, 62, 8).clip(); doc.image(cover, R - 62, y - 2, { fit: [62, 62], align: "center", valign: "center" }); doc.restore(); doc.roundedRect(R - 62, y - 2, 62, 62, 8).lineWidth(0.75).stroke(LINE); coverOk = true; } catch { coverOk = false; } }
      const titleW = coverOk ? W - 74 : W;
      doc.fillColor(INK).font("Sans-Bold").fontSize(23).text("Splitt- og bidragsavtale", L, y, { width: titleW });
      doc.fillColor(GREY).font("Sans").fontSize(13).text(title, L, doc.y + 1, { width: titleW });
      y = Math.max(doc.y + 12, coverOk ? 92 + 62 + 6 : doc.y + 12);

      const signedCount = contributors.filter((c) => c.signed_at).length;
      const full = status === "completed" || (contributors.length > 0 && signedCount >= contributors.length);
      pill(L, y, full ? "FULLT SIGNERT" : signedCount > 0 ? `${signedCount}/${contributors.length} SIGNERT` : "IKKE SIGNERT", full ? GREENBG : AMBERBG, full ? GREEN : AMBER);
      doc.fillColor(FAINT).font("Sans").fontSize(8.5).text(`Generert ${new Date().toLocaleString("no-NO")}`, L, y + 3.5, { width: W, align: "right" });
      y += 30;

      const masterTotal = Math.round(contributors.reduce((a, c) => a + Number(c.percentage || 0), 0) * 100) / 100;
      const compTotal = Math.round(contributors.reduce((a, c) => a + Number(c.custom_fields?.compositionPct || 0), 0) * 100) / 100;

      // ── TABELL: parter og fordeling ──
      doc.fillColor(INK).font("Sans-Bold").fontSize(11).text("Parter og fordeling", L, y); y = doc.y + 8;
      const CX = { name: L + 10, master: 210, comp: 268, fee: 326, status: 452 };
      const drawHead = () => {
        doc.rect(L, y, W, 22).fill(INK);
        doc.fillColor("#fff").font("Sans-Bold").fontSize(7.5);
        doc.text("PART", CX.name, y + 7.5, { lineBreak: false });
        doc.text("MASTER", CX.master, y + 7.5, { width: 50, align: "right" });
        doc.text("KOMP.", CX.comp, y + 7.5, { width: 50, align: "right" });
        doc.text("HONORAR", CX.fee, y + 7.5, { width: 118, align: "right" });
        doc.text("STATUS", CX.status, y + 7.5, { width: 83, align: "right" });
        y += 22;
      };
      drawHead();
      contributors.forEach((c, i) => {
        const RH = 32;
        if (y + RH > PH - 70) { doc.addPage(); y = 60; drawHead(); }
        const cf = c.custom_fields || {};
        if (i % 2 === 1) doc.rect(L, y, W, RH).fill(CREAM);
        doc.fillColor(INK).font("Sans-Bold").fontSize(9.5).text(c.name || "—", CX.name, y + 7, { width: 150, lineBreak: false, ellipsis: true });
        const sub = [c.role, ...((cf.contributions || []))].filter(Boolean).join(" · ") || "—";
        doc.fillColor(GREY).font("Sans").fontSize(7.5).text(sub, CX.name, y + 19, { width: 150, lineBreak: false, ellipsis: true });
        doc.fillColor(INK).font("Sans").fontSize(10);
        doc.text(`${Number(c.percentage) || 0}%`, CX.master, y + 11, { width: 50, align: "right" });
        doc.text(`${Number(cf.compositionPct) || 0}%`, CX.comp, y + 11, { width: 50, align: "right" });
        const feeStr = Number(cf.feeAmount) > 0 ? `${Number(cf.feeAmount).toLocaleString("no-NO")} ${cf.feeCurrency || "NOK"}` : "—";
        doc.fontSize(9.5).text(feeStr, CX.fee, y + 7, { width: 118, align: "right" });
        if (Number(cf.feeAmount) > 0) doc.fillColor(FAINT).fontSize(6.5).text(FEE_LABEL[cf.feeType] || cf.feeType || "royalty", CX.fee, y + 19, { width: 118, align: "right" });
        const pl = c.signed_at ? { t: "Signert", bg: GREENBG, fg: GREEN } : { t: "Venter", bg: AMBERBG, fg: AMBER };
        doc.font("Sans-Bold").fontSize(7.5);
        const pw = doc.widthOfString(pl.t) + 16;
        pill(R - 10 - pw, y + 8.5, pl.t, pl.bg, pl.fg);
        y += RH;
        doc.strokeColor(LINE).lineWidth(0.5).moveTo(L, y).lineTo(R, y).stroke();
      });
      // Sum-rad
      const balanced = Math.abs(masterTotal - 100) < 0.01;
      doc.rect(L, y, W, 24).fill(balanced ? GREENBG : "#fdeceb");
      doc.fillColor(INK).font("Sans-Bold").fontSize(8.5).text("SUM", CX.name, y + 8, { lineBreak: false });
      doc.fillColor(balanced ? GREEN : RED).fontSize(10).text(`${masterTotal}%`, CX.master, y + 7.5, { width: 50, align: "right" });
      doc.text(`${compTotal}%`, CX.comp, y + 7.5, { width: 50, align: "right" });
      if (!balanced) doc.fillColor(RED).font("Sans").fontSize(7).text("master ≠ 100%", CX.fee, y + 8.5, { width: 118, align: "right" });
      y += 24 + 26;

      // ── SIGNATURER ──
      if (y > PH - 140) { doc.addPage(); y = 60; }
      doc.fillColor(INK).font("Sans-Bold").fontSize(11).text("Signaturer", L, y); y = doc.y + 8;
      const signed = contributors.filter((c) => c.signed_at);
      if (!signed.length) {
        doc.fillColor(GREY).font("Sans").fontSize(9.5).text("Ingen parter har signert ennå.", L, y); y = doc.y + 4;
      }
      signed.forEach((c) => {
        const sd = c.signature_data || {}; const CH = 56;
        if (y + CH > PH - 70) { doc.addPage(); y = 60; }
        doc.roundedRect(L, y, W, CH, 8).fillAndStroke(CREAM, LINE);
        doc.fillColor(INK).font("Sans-Bold").fontSize(10).text(sd.name || c.name, L + 14, y + 11, { width: 280, lineBreak: false, ellipsis: true });
        doc.fillColor(GREEN).font("Sans").fontSize(8).text(`Elektronisk signatur · ${new Date(c.signed_at).toLocaleString("no-NO")}`, L + 14, y + 26, { lineBreak: false });
        if (sd.signatureHash) doc.fillColor(FAINT).font("Sans").fontSize(6.5).text(`SHA-256: ${sd.signatureHash}`, L + 14, y + 40, { width: W - 28, lineBreak: false });
        // Signatur til høyre: tegnet/typografert bilde hvis levert, ellers stilisert navn.
        let imgOk = false;
        if (sd.signatureImage && typeof sd.signatureImage === "string" && sd.signatureImage.startsWith("data:image/png;base64,")) {
          try { doc.image(Buffer.from(sd.signatureImage.split(",")[1], "base64"), R - 174, y + 6, { fit: [160, 30], align: "right", valign: "bottom" }); imgOk = true; } catch { imgOk = false; }
        }
        if (!imgOk) doc.fillColor(INK).font("Sans-Oblique").fontSize(16).text(sd.name || c.name, R - 214, y + 16, { width: 200, align: "right" });
        doc.strokeColor(LINE).lineWidth(0.75).moveTo(R - 214, y + 40).lineTo(R - 14, y + 40).stroke();
        y += CH + 8;
      });

      // ── JURIDISK NOTE ──
      y += 6;
      if (y > PH - 124) { doc.addPage(); y = 60; }
      doc.roundedRect(L, y, W, 96, 8).fill(CREAM);
      doc.fillColor(INK).font("Sans-Bold").fontSize(8.5).text("Om signaturen", L + 14, y + 11, { lineBreak: false });
      doc.fillColor(GREY).font("Sans").fontSize(8).text(
        "Avtalen er inngått med enkel elektronisk signatur. Hver part har bekreftet sin andel ved aktivt samtykke, og hver " +
        "signatur er bundet til en SHA-256 integritetskontroll over de nøyaktige vilkårene på signeringstidspunktet. Endres " +
        "vilkårene oppheves alle signaturer, og partene må signere på nytt. Personopplysninger (navn, tidspunkt, IP-adresse og " +
        "signatur) behandles for å inngå og dokumentere avtalen (GDPR art. 6(1)(b)); partene kan be om innsyn eller sletting. " +
        "Dokumentet er ment som etterprøvbart bevis på enighet om fordeling av master- (Gramo) og komposisjonsrettigheter (TONO).",
        L + 14, y + 24, { width: W - 28, align: "left", lineGap: 1 });

      // ── FOTER på hver side ──
      const range = doc.bufferedPageRange();
      for (let i = 0; i < range.count; i++) {
        doc.switchToPage(range.start + i);
        doc.strokeColor(LINE).lineWidth(0.5).moveTo(L, PH - 38).lineTo(R, PH - 38).stroke();
        doc.fillColor(FAINT).font("Sans").fontSize(7.5).text(`${brand.name || "CreatorHub"} · Audio Showcase — etterprøvbart avtaledokument`, L, PH - 30, { lineBreak: false });
        doc.fillColor(FAINT).text(`Ref. ${agreementId}   ·   Side ${i + 1}/${range.count}`, L, PH - 30, { width: W, align: "right" });
      }
      doc.end();
    });
  }
  // Hent produsentens branding. Kilde-prioritet:
  //   1) Audio Showcase-override (audio_showcase_branding, valgfri)
  //   2) Universell business-branding fra Universal Dashboard (getBrandingForUser)
  //   3) CreatorHub fallback-logo
  // Hent bilde-bytes fra B2/https/data-URL/relativ asset (for PDF-innbygging).
  async function fetchImageBytes(rawUrl?: string | null): Promise<Buffer | null> {
    if (!rawUrl) return null;
    let url = rawUrl;
    if (url.startsWith("/")) url = APP_URL + url; // relativ asset → absolutt
    try {
      if (url.startsWith("data:image")) return Buffer.from(url.split(",")[1] || "", "base64");
      if (/^https?:\/\//.test(url)) { const r = await fetch(url); if (r.ok) return Buffer.from(await r.arrayBuffer()); }
    } catch { /* ignore */ }
    return null;
  }

  async function loadBrand(userId: string): Promise<{ name: string; accent: string; logo: Buffer | null }> {
    const r = await pool.query(`SELECT brand_name, logo_url, accent_color FROM audio_showcase_branding WHERE user_id=$1 LIMIT 1`, [userId]).catch(() => ({ rows: [] as any[] }));
    const ov = r.rows[0] || {};
    let uni: { businessName?: string; logoUrl?: string; accentColor?: string } = {};
    if (getBrandingForUser) { try { uni = (await getBrandingForUser(userId)) || {}; } catch { uni = {}; } }
    const hex = (v?: string) => (/^#[0-9a-fA-F]{6}$/.test(v || "") ? (v as string) : "");
    const name = ov.brand_name || uni.businessName || "";
    const accent = hex(ov.accent_color) || hex(uni.accentColor) || "";
    const logo = await fetchImageBytes(ov.logo_url || uni.logoUrl || "");
    return { name, accent, logo: logo || fallbackLogo() };
  }

  async function agreementPdfResponse(res: any, ssId: string, title: string) {
    const ss = await pool.query(`SELECT status, user_id, metadata->>'sourceReviewId' AS review_id FROM split_sheets WHERE id=$1 LIMIT 1`, [ssId]);
    if (ss.rowCount === 0) return res.status(404).json({ error: "no_split_sheet" });
    const c = await pool.query(`SELECT name, role, percentage, signed_at, custom_fields, signature_data FROM split_sheet_contributors WHERE split_sheet_id=$1 ORDER BY order_index ASC`, [ssId]);
    const agreementId = String(ssId).replace(/-/g, "").slice(0, 8).toUpperCase();
    const brand = await loadBrand(ss.rows[0].user_id);
    // Cover-bilde av låta (hvis prosjektet har det) → vises i avtalen.
    let cover: Buffer | null = null;
    if (ss.rows[0].review_id) {
      const pr = await pool.query(`SELECT cover_url FROM audio_review_projects WHERE id=$1::uuid LIMIT 1`, [ss.rows[0].review_id]).catch(() => ({ rows: [] as any[] }));
      cover = await fetchImageBytes(pr.rows[0]?.cover_url);
    }
    const pdf = await buildAgreementPdf(title, ss.rows[0].status, c.rows, agreementId, brand, cover);
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="splittavtale-${(title || "avtale").replace(/[^a-z0-9]/gi, "-").toLowerCase()}.pdf"`);
    return res.end(pdf);
  }

  // Per-produsent branding (egen logo/navn/farge på avtaledokumenter).
  app.get("/api/audio-showcase/branding", async (req, res) => {
    const s = requireUserSession(req, res); if (!s) return;
    try {
      const r = await pool.query(`SELECT brand_name, logo_url, accent_color FROM audio_showcase_branding WHERE user_id=$1 LIMIT 1`, [s.userId]);
      const b = r.rows[0] || {};
      return res.json({ brandName: b.brand_name || "", logoUrl: b.logo_url || "", accentColor: b.accent_color || "" });
    } catch (e) { if (isMissingTable(e)) return res.json({ brandName: "", logoUrl: "", accentColor: "" }); return res.status(500).json({ error: "branding_get_failed" }); }
  });
  app.put("/api/audio-showcase/branding", async (req, res) => {
    const s = requireUserSession(req, res); if (!s) return;
    const brandName = str(req.body?.brandName, 120) || null;
    const logoUrl = str(req.body?.logoUrl, 3_000_000) || null;
    const ac = str(req.body?.accentColor, 9);
    const accentColor = /^#[0-9a-fA-F]{6}$/.test(ac) ? ac : null;
    try {
      await pool.query(
        `INSERT INTO audio_showcase_branding (user_id, brand_name, logo_url, accent_color, updated_at)
         VALUES ($1,$2,$3,$4,NOW())
         ON CONFLICT (user_id) DO UPDATE SET brand_name=$2, logo_url=$3, accent_color=$4, updated_at=NOW()`,
        [s.userId, brandName, logoUrl, accentColor]);
      return res.json({ ok: true, brandName: brandName || "", logoUrl: logoUrl || "", accentColor: accentColor || "" });
    } catch (e) { if (isMissingTable(e)) return res.status(503).json({ error: "migration_pending" }); return res.status(500).json({ error: "branding_save_failed" }); }
  });

  // Veiledende honorar-satser (kuratert fra Creos frilanssatser) — utgangspunkt
  // for honorar i splittarket. Creo har ikke API; tabellen oppdateres manuelt.
  // Kilde: https://creokultur.no/lonn-og-arbeidsvilkar/frilanssatser/
  app.get("/api/audio-showcase/rate-guidance", (_req, res) => {
    res.json({
      source: "Creo – frilanssatser",
      sourceUrl: "https://creokultur.no/lonn-og-arbeidsvilkar/frilanssatser/",
      updated: "2026-05-12",
      currency: "NOK",
      markupNote: "Veiledende minstesatser (ikke maks). Næringsdrivende legger normalt til Creos påslag på 38,8 %.",
      rates: [
        { key: "studio", label: "Studio / innspilling (fonogram)", amount: 1680, unit: "per time", note: "Minimum 3 timer. Prøvetid faktureres likt." },
        { key: "concert", label: "Konsert", amount: 6200, unit: "per musiker", note: "Per konsert." },
        { key: "rehearsal3", label: "Prøve (innkalt, inntil 3 t)", amount: 4650, unit: "fast", note: "Deretter 1 040 kr per time." },
        { key: "rehearsal_hour", label: "Prøve (innkalt, per time utover 3)", amount: 1040, unit: "per time", note: "" },
        { key: "prep", label: "Egenøving / forberedelse / admin", amount: 620, unit: "per time", note: "" },
        { key: "radiotv", label: "Radio/TV-studio (inntil 3 t)", amount: 2291, unit: "fast", note: "" },
        { key: "tech_day", label: "Scene / teknisk", amount: 5895, unit: "per dag", note: "Inntil 10 timer." },
      ],
    });
  });

  // ══ YOUTUBE-PUBLISERING ════════════════════════════════════════════════════
  // Gjenbruker eksisterende Google/YouTube-tilkobling (youtube-routes /api/youtube).
  // Status/connect skjer der; her genererer vi video (visualizer eller lyric-video)
  // og laster opp. Lyrics hentes fra koblet EaseVerse-track.
  app.get("/api/releases/:id/youtube/options", async (req, res) => {
    const s = requireUserSession(req, res); if (!s) return;
    try {
      const r = await pool.query(`SELECT easeverse_track_id, master_url, title, primary_artist FROM audio_releases WHERE id=$1::uuid AND owner_user_id=$2 LIMIT 1`, [str(req.params.id, 64), s.userId]);
      if (r.rowCount === 0) return res.status(404).json({ error: "not_found" });
      const rel = r.rows[0];
      let hasLyrics = false;
      if (rel.easeverse_track_id) {
        const t = await pool.query(`SELECT lyrics FROM easeverse_tracks WHERE id=$1::uuid LIMIT 1`, [rel.easeverse_track_id]).catch(() => ({ rows: [] as any[] }));
        hasLyrics = !!str(t.rows[0]?.lyrics, 50);
      }
      let hasTiming = false;
      if (rel.easeverse_track_id) {
        const t = await pool.query(`SELECT lyrics_timing FROM easeverse_tracks WHERE id=$1::uuid LIMIT 1`, [rel.easeverse_track_id]).catch(() => ({ rows: [] as any[] }));
        hasTiming = Array.isArray(t.rows[0]?.lyrics_timing) && t.rows[0].lyrics_timing.length > 0;
      }
      return res.json({ available: !!getYoutubeClient, hasMaster: !!rel.master_url, hasLyrics, hasTiming, suggestedTitle: `${rel.primary_artist ? rel.primary_artist + " – " : ""}${rel.title}` });
    } catch (e) { if (isMissingTable(e)) return res.json({ available: false, hasMaster: false, hasLyrics: false }); return res.status(500).json({ error: "yt_options_failed" }); }
  });

  // Tap-to-time: hent linjer + eksisterende timing for et review-rom.
  app.get("/api/audio-showcases/:id/lyric-timing", async (req, res) => {
    const s = requireUserSession(req, res); if (!s) return;
    try {
      const p = await pool.query(`SELECT easeverse_track_id FROM audio_review_projects WHERE id=$1::uuid AND owner_user_id=$2 LIMIT 1`, [str(req.params.id, 64), s.userId]);
      if (p.rowCount === 0) return res.status(404).json({ error: "not_found" });
      const trackId = p.rows[0].easeverse_track_id;
      if (!trackId) return res.json({ lines: [], timing: null });
      const t = await pool.query(`SELECT lyrics, lyrics_timing FROM easeverse_tracks WHERE id=$1::uuid LIMIT 1`, [trackId]);
      const lines = lyricLines(str(t.rows[0]?.lyrics, 20000));
      const timing = Array.isArray(t.rows[0]?.lyrics_timing) ? t.rows[0].lyrics_timing : null;
      return res.json({ lines, timing });
    } catch (e) { if (isMissingTable(e)) return res.json({ lines: [], timing: null }); return res.status(500).json({ error: "timing_get_failed" }); }
  });

  // Lagre timing (sekunder per linje, stigende).
  app.put("/api/audio-showcases/:id/lyric-timing", async (req, res) => {
    const s = requireUserSession(req, res); if (!s) return;
    const timing = Array.isArray(req.body?.timing) ? req.body.timing.map((n: unknown) => Number(n)).filter((n: number) => Number.isFinite(n) && n >= 0) : null;
    if (!timing) return res.status(400).json({ error: "timing_required" });
    try {
      const p = await pool.query(`SELECT easeverse_track_id FROM audio_review_projects WHERE id=$1::uuid AND owner_user_id=$2 LIMIT 1`, [str(req.params.id, 64), s.userId]);
      if (p.rowCount === 0 || !p.rows[0].easeverse_track_id) return res.status(404).json({ error: "not_found" });
      await pool.query(`UPDATE easeverse_tracks SET lyrics_timing=$2::jsonb, updated_at=NOW() WHERE id=$1::uuid AND user_id=$3`, [p.rows[0].easeverse_track_id, JSON.stringify(timing), s.userId]);
      return res.json({ ok: true, count: timing.length });
    } catch (e) { if (isMissingTable(e)) return res.status(503).json({ error: "migration_pending" }); return res.status(500).json({ error: "timing_save_failed" }); }
  });

  // ══ SPOTIFY-VERKTØY (manuelle hjelpemidler — Spotify har ikke opplastings-API) ══
  // Canvas-klipp (9:16, ~6 s) generert fra coveret — lastes opp i Spotify for Artists.
  app.get("/api/releases/:id/canvas", async (req, res) => {
    const s = requireUserSession(req, res); if (!s) return;
    const tmp: string[] = [];
    try {
      const r = await pool.query(`SELECT cover_url, title, master_url, review_project_id FROM audio_releases WHERE id=$1::uuid AND owner_user_id=$2 LIMIT 1`, [str(req.params.id, 64), s.userId]);
      if (r.rowCount === 0) return res.status(404).json({ error: "not_found" });
      const cover = (await fetchImageBytes(r.rows[0].cover_url)) || fallbackLogo();
      if (!cover) return res.status(422).json({ error: "no_cover" });
      const base = join(tmpdir(), `canvas-${randomUUID()}`);
      const coverPath = `${base}.png`, outPath = `${base}.mp4`; tmp.push(coverPath, outPath);
      await writeFile(coverPath, cover);
      // Valgfritt: audio-reaktivt bølgelag fra masteren + merkefarge.
      let audioPath: string | undefined; let audioStart = 0;
      const audio = await fetchImageBytes(r.rows[0].master_url);
      if (audio) {
        const ap = `${base}.audio`; tmp.push(ap); await writeFile(ap, audio);
        const dur = await probeDuration(ap); // verifiser at fila faktisk er lyd
        if (dur > 0) { audioPath = ap; audioStart = Math.min(Math.max(0, dur - 6), Math.round(dur * 0.3)); }
      }
      // Beat-puls fra prosjektets BPM (hvis kjent).
      let bpm = 0;
      if (r.rows[0].review_project_id) {
        const pr = await pool.query(`SELECT bpm FROM audio_review_projects WHERE id=$1::uuid LIMIT 1`, [r.rows[0].review_project_id]).catch(() => ({ rows: [] as any[] }));
        bpm = Number(pr.rows[0]?.bpm) || 0;
      }
      const brand = await loadBrand(s.userId);
      const square = str(req.query?.format, 8) === "square"; // Apple Music motion art (1:1)
      await buildCanvas(coverPath, outPath, { audioPath, audioStart, accentHex: brand.accent || undefined, bpm, square });
      const buf = await import("node:fs/promises").then((m) => m.readFile(outPath));
      res.setHeader("Content-Type", "video/mp4");
      res.setHeader("Content-Disposition", `attachment; filename="${square ? "motion-art" : "canvas"}-${(r.rows[0].title || "release").replace(/[^a-z0-9]/gi, "-").toLowerCase()}.mp4"`);
      return res.end(buf);
    } catch (e) { if (isMissingTable(e)) return res.status(503).json({ error: "migration_pending" }); console.error("[canvas] failed:", e); return res.status(500).json({ error: "canvas_failed" }); }
    finally { for (const f of tmp) unlink(f).catch(() => {}); }
  });

  // Produsenten laster opp sitt EGET klipp → prosesseres til Canvas-spec (9:16, ~6 s, stille).
  if (uploadClip) {
    app.post("/api/releases/:id/canvas/from-clip", uploadClip.single("clip"), async (req: any, res) => {
      const s = requireUserSession(req, res); if (!s) return;
      const file = req.file;
      if (!file?.buffer) return res.status(400).json({ error: "clip_required" });
      if (!/^video\//.test(file.mimetype || "")) return res.status(415).json({ error: "not_a_video" });
      const tmp: string[] = [];
      try {
        const r = await pool.query(`SELECT title FROM audio_releases WHERE id=$1::uuid AND owner_user_id=$2 LIMIT 1`, [str(req.params.id, 64), s.userId]);
        if (r.rowCount === 0) return res.status(404).json({ error: "not_found" });
        const base = join(tmpdir(), `canvasclip-${randomUUID()}`);
        const clipPath = `${base}.in`, outPath = `${base}.mp4`; tmp.push(clipPath, outPath);
        await writeFile(clipPath, file.buffer);
        await buildCanvasFromClip(clipPath, outPath, { start: Number(req.body?.start) || 0 });
        const buf = await import("node:fs/promises").then((m) => m.readFile(outPath));
        res.setHeader("Content-Type", "video/mp4");
        res.setHeader("Content-Disposition", `attachment; filename="canvas-${(r.rows[0].title || "release").replace(/[^a-z0-9]/gi, "-").toLowerCase()}.mp4"`);
        return res.end(buf);
      } catch (e) { if (isMissingTable(e)) return res.status(503).json({ error: "migration_pending" }); console.error("[canvas-clip] failed:", e); return res.status(500).json({ error: "canvas_clip_failed" }); }
      finally { for (const f of tmp) unlink(f).catch(() => {}); }
    });
  }

  // Reels/TikTok-klipp: 9:16 MED lyd fra coveret + master (audio-reaktiv bølge).
  app.get("/api/releases/:id/social-clip", async (req, res) => {
    const s = requireUserSession(req, res); if (!s) return;
    const tmp: string[] = [];
    try {
      const r = await pool.query(`SELECT cover_url, title, master_url FROM audio_releases WHERE id=$1::uuid AND owner_user_id=$2 LIMIT 1`, [str(req.params.id, 64), s.userId]);
      if (r.rowCount === 0) return res.status(404).json({ error: "not_found" });
      if (!r.rows[0].master_url) return res.status(400).json({ error: "no_master" });
      const cover = (await fetchImageBytes(r.rows[0].cover_url)) || fallbackLogo();
      const audio = await fetchImageBytes(r.rows[0].master_url);
      const base = join(tmpdir(), `social-${randomUUID()}`);
      const coverPath = `${base}.png`, audioPath = `${base}.audio`, outPath = `${base}.mp4`; tmp.push(coverPath, audioPath, outPath);
      await writeFile(coverPath, cover || Buffer.alloc(0)); await writeFile(audioPath, audio || Buffer.alloc(0));
      if ((await probeDuration(audioPath)) <= 0) return res.status(422).json({ error: "master_unreachable" });
      const brand = await loadBrand(s.userId);
      const maxSec = Math.min(Math.max(Number(req.query?.maxSec) || 30, 5), 90);
      await buildSocialClip(coverPath, audioPath, outPath, { accentHex: brand.accent || undefined, maxSec, start: Number(req.query?.start) || 0 });
      const buf = await import("node:fs/promises").then((m) => m.readFile(outPath));
      res.setHeader("Content-Type", "video/mp4");
      res.setHeader("Content-Disposition", `attachment; filename="reel-${(r.rows[0].title || "release").replace(/[^a-z0-9]/gi, "-").toLowerCase()}.mp4"`);
      return res.end(buf);
    } catch (e) { if (isMissingTable(e)) return res.status(503).json({ error: "migration_pending" }); console.error("[social-clip] failed:", e); return res.status(500).json({ error: "social_clip_failed" }); }
    finally { for (const f of tmp) unlink(f).catch(() => {}); }
  });

  // Tekst-eksport for Musixmatch: ren .txt, eller timed .lrc hvis timing finnes.
  app.get("/api/releases/:id/lyrics-export", async (req, res) => {
    const s = requireUserSession(req, res); if (!s) return;
    const format = str(req.query?.format, 8) === "lrc" ? "lrc" : "txt";
    try {
      const r = await pool.query(`SELECT easeverse_track_id, title, primary_artist FROM audio_releases WHERE id=$1::uuid AND owner_user_id=$2 LIMIT 1`, [str(req.params.id, 64), s.userId]);
      if (r.rowCount === 0 || !r.rows[0].easeverse_track_id) return res.status(404).json({ error: "not_found" });
      const t = await pool.query(`SELECT lyrics, lyrics_timing FROM easeverse_tracks WHERE id=$1::uuid LIMIT 1`, [r.rows[0].easeverse_track_id]);
      const lyrics = str(t.rows[0]?.lyrics, 20000);
      if (!lyrics) return res.status(404).json({ error: "no_lyrics" });
      const slug = (r.rows[0].title || "lyrics").replace(/[^a-z0-9]/gi, "-").toLowerCase();
      const lines = lyricLines(lyrics);
      const timing: number[] | null = Array.isArray(t.rows[0]?.lyrics_timing) ? t.rows[0].lyrics_timing : null;
      let body: string, ext: string;
      if (format === "lrc" && timing && timing.length === lines.length) {
        const head = `[ti:${r.rows[0].title || ""}]\n[ar:${r.rows[0].primary_artist || ""}]\n[tool:CreatorHub Audio Showcase]\n`;
        body = head + lines.map((ln, i) => `${lrcStamp(Number(timing[i]) || 0)}${ln}`).join("\n") + "\n"; ext = "lrc";
      } else {
        body = lines.join("\n") + "\n"; ext = "txt";
      }
      res.setHeader("Content-Type", ext === "lrc" ? "application/octet-stream" : "text/plain; charset=utf-8");
      res.setHeader("Content-Disposition", `attachment; filename="${slug}.${ext}"`);
      return res.end(body);
    } catch (e) { if (isMissingTable(e)) return res.status(503).json({ error: "migration_pending" }); return res.status(500).json({ error: "lyrics_export_failed" }); }
  });

  app.post("/api/releases/:id/youtube/publish", async (req, res) => {
    const s = requireUserSession(req, res); if (!s) return;
    if (!getYoutubeClient) return res.status(503).json({ error: "youtube_not_configured" });
    const tmp: string[] = [];
    try {
      const rel = await pool.query(`SELECT * FROM audio_releases WHERE id=$1::uuid AND owner_user_id=$2 LIMIT 1`, [str(req.params.id, 64), s.userId]);
      if (rel.rowCount === 0) return res.status(404).json({ error: "not_found" });
      const r = rel.rows[0];
      if (!r.master_url) return res.status(400).json({ error: "no_master" });

      // Autorisert YouTube-klient (eksisterende Google-tilkobling). Mangler den → 409.
      let client: { youtube: any } | null = null;
      try { client = await getYoutubeClient(s.userId, req); } catch { client = null; }
      if (!client?.youtube) return res.status(409).json({ error: "not_connected" });

      // Hent cover + master til temp.
      const cover = (await fetchImageBytes(r.cover_url)) || fallbackLogo();
      const audio = await fetchImageBytes(r.master_url);
      if (!audio) return res.status(422).json({ error: "master_unreachable" });
      const base = join(tmpdir(), `yt-${randomUUID()}`);
      const coverPath = `${base}.png`, audioPath = `${base}.audio`, outPath = `${base}.mp4`;
      tmp.push(coverPath, audioPath, outPath);
      await writeFile(coverPath, cover || Buffer.alloc(0));
      await writeFile(audioPath, audio);

      // Lyric-video: karaoke (beat-synket) hvis timing finnes + valgt, ellers scroll.
      const durationSec = await probeDuration(audioPath);
      let lyricsImagePath: string | undefined; let lyricsHeight = 0;
      let karaoke: { stackedPath: string; vignettePath: string; starts: number[] } | undefined;
      let videoMode: "karaoke" | "scroll" | "visualizer" = "visualizer";
      if (req.body?.includeLyrics && r.easeverse_track_id) {
        const t = await pool.query(`SELECT lyrics, lyrics_timing FROM easeverse_tracks WHERE id=$1::uuid LIMIT 1`, [r.easeverse_track_id]).catch(() => ({ rows: [] as any[] }));
        const lyrics = str(t.rows[0]?.lyrics, 20000);
        const timing: number[] | null = Array.isArray(t.rows[0]?.lyrics_timing) ? t.rows[0].lyrics_timing : null;
        if (lyrics) {
          const lines = lyricLines(lyrics);
          const wantKaraoke = req.body?.lyricStyle !== "scroll";
          if (wantKaraoke && timing && timing.length === lines.length && lines.length > 0) {
            // Beat-synket karaoke.
            const stacked = await renderStackedLyrics(lines);
            const vignette = await renderVignette();
            const stackedPath = `${base}.karaoke.png`, vignettePath = `${base}.vignette.png`;
            tmp.push(stackedPath, vignettePath);
            await writeFile(stackedPath, stacked); await writeFile(vignettePath, vignette);
            karaoke = { stackedPath, vignettePath, starts: timing.map((n) => Number(n) || 0) };
            videoMode = "karaoke";
          } else {
            // Jevn scroll-fallback.
            const clean = lyrics.replace(/^\s*\[[^\]]*\]\s*$/gm, "").replace(/\n{3,}/g, "\n\n").trim();
            const img = await renderLyricsImage(clean, r.title || "", r.primary_artist || "");
            lyricsImagePath = `${base}.lyrics.png`; lyricsHeight = img.height; tmp.push(lyricsImagePath);
            await writeFile(lyricsImagePath, img.buffer);
            videoMode = "scroll";
          }
        }
      }
      await buildVideo(coverPath, audioPath, outPath, { lyricsImagePath, lyricsHeight, durationSec, karaoke });

      const title = str(req.body?.title, 100) || `${r.primary_artist ? r.primary_artist + " – " : ""}${r.title}`;
      const description = str(req.body?.description, 4500) || `${r.title}${r.primary_artist ? ` av ${r.primary_artist}` : ""}.`;
      const privacy = ["public", "unlisted", "private"].includes(String(req.body?.privacy)) ? String(req.body.privacy) : "private";
      const tags = Array.isArray(req.body?.tags) ? req.body.tags.filter((t: unknown) => typeof t === "string").slice(0, 15) : [r.primary_artist, r.primary_genre].filter(Boolean);
      const ins = await client.youtube.videos.insert({
        part: ["snippet", "status"],
        requestBody: { snippet: { title, description, tags, categoryId: "10" }, status: { privacyStatus: privacy, selfDeclaredMadeForKids: false } },
        media: { body: createReadStream(outPath) },
      });
      const videoId = ins.data.id; const url = videoId ? `https://youtu.be/${videoId}` : null;
      await pool.query(`INSERT INTO youtube_publications (release_id, user_id, video_id, video_url, privacy, status) VALUES ($1::uuid,$2,$3,$4,$5,'uploaded')`, [r.id, s.userId, videoId, url, privacy]).catch(() => {});
      return res.json({ ok: true, videoId, url, privacy, videoMode });
    } catch (e: any) {
      console.error("[youtube] publish failed:", e?.message || e);
      if (isMissingTable(e)) return res.status(503).json({ error: "migration_pending" });
      return res.status(500).json({ error: "youtube_publish_failed", detail: String(e?.message || "").slice(0, 200) });
    } finally { for (const f of tmp) unlink(f).catch(() => {}); }
  });

  // Eier laster ned signert avtale-PDF.
  app.get("/api/audio-showcases/:id/agreement.pdf", async (req, res) => {
    const s = requireUserSession(req, res); if (!s) return;
    try {
      const ss = await pool.query(`SELECT s.id, s.title FROM split_sheets s WHERE s.user_id=$1 AND s.metadata->>'sourceReviewId'=$2 LIMIT 1`, [s.userId, str(req.params.id, 64)]);
      if (ss.rowCount === 0) return res.status(404).json({ error: "no_split_sheet" });
      return await agreementPdfResponse(res, ss.rows[0].id, ss.rows[0].title);
    } catch (e) { if (isMissingTable(e)) return res.status(503).json({ error: "migration_pending" }); return res.status(500).json({ error: "agreement_pdf_failed" }); }
  });

  // Part laster ned signert avtale-PDF via sin invitasjonslenke.
  app.get("/api/audio-review-shared/:token/agreement.pdf", async (req, res) => {
    const token = str(req.params.token, 80);
    if (!token.startsWith("inv_")) return res.status(400).json({ error: "invalid_token" });
    try {
      const ctx = await resolveSharedMember(token);
      if (!ctx) return res.status(404).json({ error: "not_found" });
      const ss = await pool.query(`SELECT id, title FROM split_sheets WHERE metadata->>'sourceReviewId'=$1 LIMIT 1`, [ctx.project_id]);
      if (ss.rowCount === 0) return res.status(404).json({ error: "no_split_sheet" });
      return await agreementPdfResponse(res, ss.rows[0].id, ss.rows[0].title);
    } catch (e) { if (isMissingTable(e)) return res.status(503).json({ error: "migration_pending" }); return res.status(500).json({ error: "agreement_pdf_failed" }); }
  });

  // ══ PUBLISERING (release-pakke) ═══════════════════════════════════════════
  // Opprett/hent en utgivelse fra et godkjent review-rom (idempotent).
  app.post("/api/audio-showcases/:id/release", async (req, res) => {
    const s = requireUserSession(req, res); if (!s) return;
    const id = str(req.params.id, 64);
    try {
      const p = await pool.query(`SELECT * FROM audio_review_projects WHERE id=$1::uuid AND owner_user_id=$2 LIMIT 1`, [id, s.userId]);
      if (p.rowCount === 0) return res.status(404).json({ error: "not_found" });
      const proj = p.rows[0];
      const existing = await pool.query(`SELECT * FROM audio_releases WHERE review_project_id=$1::uuid AND owner_user_id=$2 ORDER BY created_at DESC LIMIT 1`, [id, s.userId]);
      if (existing.rowCount > 0) return res.json({ release: existing.rows[0], created: false });
      // Velg master: godkjent versjon, ellers nyeste ikke-superseded.
      const v = await pool.query(
        `SELECT id, file_url FROM audio_review_versions WHERE project_id=$1::uuid
          ORDER BY (status='approved') DESC, (status<>'superseded') DESC, version_number DESC LIMIT 1`, [id]);
      const master = v.rows[0] || {};
      const r = await pool.query(
        `INSERT INTO audio_releases (owner_user_id, review_project_id, easeverse_track_id, title, primary_artist, primary_genre, cover_url, master_version_id, master_url, copyright_year, p_line, c_line)
         VALUES ($1,$2::uuid,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING *`,
        [s.userId, id, proj.external_track_id || proj.easeverse_track_id || null, proj.title || "Uten tittel",
         proj.band_name || proj.artist_name || null, proj.genre || null, proj.cover_url || null,
         master.id || null, master.file_url || null, new Date().getFullYear(),
         proj.band_name ? `${new Date().getFullYear()} ${proj.band_name}` : null, proj.band_name ? `${new Date().getFullYear()} ${proj.band_name}` : null]);
      return res.status(201).json({ release: r.rows[0], created: true });
    } catch (e) {
      if (isMissingTable(e)) return res.status(503).json({ error: "migration_pending" });
      console.error("[audio-showcase] release create failed:", e);
      return res.status(500).json({ error: "release_create_failed" });
    }
  });

  app.get("/api/releases/:id", async (req, res) => {
    const s = requireUserSession(req, res); if (!s) return;
    try {
      const r = await pool.query(`SELECT * FROM audio_releases WHERE id=$1::uuid AND owner_user_id=$2 LIMIT 1`, [str(req.params.id, 64), s.userId]);
      if (r.rowCount === 0) return res.status(404).json({ error: "not_found" });
      return res.json(r.rows[0]);
    } catch (e) { if (isMissingTable(e)) return res.status(404).json({ error: "not_found" }); return res.status(500).json({ error: "release_get_failed" }); }
  });

  app.patch("/api/releases/:id", async (req, res) => {
    const s = requireUserSession(req, res); if (!s) return;
    const id = str(req.params.id, 64);
    const strMap: Array<[string, string, number]> = [
      ["title", "title", 240], ["primaryArtist", "primary_artist", 200], ["releaseType", "release_type", 20],
      ["primaryGenre", "primary_genre", 80], ["secondaryGenre", "secondary_genre", 80], ["language", "language", 16],
      ["releaseDate", "release_date", 40], ["isrc", "isrc", 20], ["upc", "upc", 20], ["label", "label", 200],
      ["pLine", "p_line", 300], ["cLine", "c_line", 300], ["coverUrl", "cover_url", 3_000_000], ["status", "status", 20],
    ];
    const sets: string[] = ["updated_at=NOW()"]; const params: unknown[] = [id, s.userId];
    for (const [body, col, max] of strMap) {
      if (typeof req.body?.[body] === "string") { params.push(str(req.body[body], max) || null); sets.push(`${col}=$${params.length}`); }
    }
    if (typeof req.body?.explicit === "boolean") { params.push(req.body.explicit); sets.push(`explicit=$${params.length}`); }
    if (Number.isFinite(Number(req.body?.copyrightYear))) { params.push(Math.round(Number(req.body.copyrightYear))); sets.push(`copyright_year=$${params.length}`); }
    if (Array.isArray(req.body?.featuredArtists)) { params.push(JSON.stringify(req.body.featuredArtists.filter((x: unknown) => typeof x === "string").slice(0, 20))); sets.push(`featured_artists=$${params.length}::jsonb`); }
    if (sets.length === 1) return res.status(400).json({ error: "nothing_to_update" });
    try {
      const r = await pool.query(`UPDATE audio_releases SET ${sets.join(", ")} WHERE id=$1::uuid AND owner_user_id=$2 RETURNING *`, params);
      if (r.rowCount === 0) return res.status(404).json({ error: "not_found" });
      return res.json(r.rows[0]);
    } catch (e) { if (isMissingTable(e)) return res.status(503).json({ error: "migration_pending" }); return res.status(500).json({ error: "release_update_failed" }); }
  });

  // Hent splitt-status for en release (for validering + pakke).
  async function releaseSplit(reviewId: string, userId: string): Promise<{ contributors: any[]; masterBalanced: boolean }> {
    const ss = await pool.query(`SELECT id FROM split_sheets WHERE user_id=$1 AND metadata->>'sourceReviewId'=$2 LIMIT 1`, [userId, reviewId]).catch(() => ({ rows: [] as any[] }));
    if (!ss.rows.length) return { contributors: [], masterBalanced: false };
    const c = await pool.query(`SELECT name, email, role, percentage, signed_at, custom_fields FROM split_sheet_contributors WHERE split_sheet_id=$1 ORDER BY order_index ASC`, [ss.rows[0].id]);
    const total = c.rows.reduce((a, x) => a + Number(x.percentage || 0), 0);
    return { contributors: c.rows, masterBalanced: Math.abs(total - 100) < 0.01 };
  }

  app.get("/api/releases/:id/validate", async (req, res) => {
    const s = requireUserSession(req, res); if (!s) return;
    try {
      const r = await pool.query(`SELECT * FROM audio_releases WHERE id=$1::uuid AND owner_user_id=$2 LIMIT 1`, [str(req.params.id, 64), s.userId]);
      if (r.rowCount === 0) return res.status(404).json({ error: "not_found" });
      const rel = r.rows[0];
      const split = rel.review_project_id ? await releaseSplit(rel.review_project_id, s.userId) : { contributors: [], masterBalanced: false };
      const isrcOk = !!rel.isrc && /^[A-Za-z]{2}[A-Za-z0-9]{3}\d{7}$/.test(String(rel.isrc).replace(/-/g, ""));
      const checks = [
        { key: "master", ok: !!rel.master_url, label: "Master-lydfil valgt" },
        { key: "cover", ok: !!rel.cover_url, label: "Cover-bilde (anbefalt 3000×3000)" },
        { key: "title", ok: !!rel.title, label: "Tittel" },
        { key: "artist", ok: !!rel.primary_artist, label: "Hovedartist" },
        { key: "genre", ok: !!rel.primary_genre, label: "Sjanger" },
        { key: "date", ok: !!rel.release_date, label: "Utgivelsesdato" },
        { key: "isrc", ok: isrcOk, label: "ISRC (gyldig format, f.eks. NOABC2500001)" },
        { key: "upc", ok: !!rel.upc, label: "UPC/strekkode" },
        { key: "rights", ok: !!rel.p_line && !!rel.c_line, label: "℗/© rettighetslinjer" },
        { key: "splits", ok: split.masterBalanced, label: "Splitt = 100% (master)" },
        { key: "credits", ok: split.contributors.length > 0, label: "Credits (bidragsytere)" },
      ];
      return res.json({ valid: checks.every((c) => c.ok), checks, contributors: split.contributors.length });
    } catch (e) { if (isMissingTable(e)) return res.status(503).json({ error: "migration_pending" }); return res.status(500).json({ error: "validate_failed" }); }
  });

  // Release-pakke: komplett manifest (metadata + credits/splitt + asset-URL-er)
  // som produsenten laster opp i sin egen distributørkonto.
  app.get("/api/releases/:id/package", async (req, res) => {
    const s = requireUserSession(req, res); if (!s) return;
    try {
      const r = await pool.query(`SELECT * FROM audio_releases WHERE id=$1::uuid AND owner_user_id=$2 LIMIT 1`, [str(req.params.id, 64), s.userId]);
      if (r.rowCount === 0) return res.status(404).json({ error: "not_found" });
      const rel = r.rows[0];
      const split = rel.review_project_id ? await releaseSplit(rel.review_project_id, s.userId) : { contributors: [] };
      const origin = `${req.headers["x-forwarded-proto"] || "https"}://${req.headers.host}`;
      const manifest = {
        release: {
          title: rel.title, primaryArtist: rel.primary_artist, featuredArtists: rel.featured_artists,
          type: rel.release_type, primaryGenre: rel.primary_genre, secondaryGenre: rel.secondary_genre,
          language: rel.language, explicit: rel.explicit, releaseDate: rel.release_date,
          isrc: rel.isrc, upc: rel.upc, label: rel.label, copyrightYear: rel.copyright_year,
          pLine: rel.p_line, cLine: rel.c_line,
        },
        assets: {
          master: rel.master_url ? (rel.master_url.startsWith("http") ? rel.master_url : `${origin}${rel.master_url}`) : null,
          cover: rel.cover_url ? (rel.cover_url.startsWith("http") ? rel.cover_url : `${origin}${rel.cover_url}`) : null,
        },
        credits: split.contributors.map((c: any) => ({
          name: c.name, role: c.role, contributions: c.custom_fields?.contributions || [],
          masterShare: Number(c.percentage), compositionShare: c.custom_fields?.compositionPct ?? null,
          fee: c.custom_fields?.feeAmount ? `${c.custom_fields.feeAmount} ${c.custom_fields.feeCurrency || "NOK"}` : null,
          signed: !!c.signed_at, signedAt: c.signed_at || null,
        })),
        generatedAt: new Date().toISOString(),
      };
      await pool.query(`UPDATE audio_releases SET status='exported', exported_at=NOW(), updated_at=NOW() WHERE id=$1::uuid`, [rel.id]).catch(() => {});
      res.setHeader("Content-Disposition", `attachment; filename="release-${(rel.title || "release").replace(/[^a-z0-9]/gi, "-").toLowerCase()}.json"`);
      return res.json(manifest);
    } catch (e) { if (isMissingTable(e)) return res.status(503).json({ error: "migration_pending" }); return res.status(500).json({ error: "package_failed" }); }
  });

  // Hent eksisterende release for et review-rom UTEN å opprette (for studio-embed).
  app.get("/api/audio-showcases/:id/release", async (req, res) => {
    const s = requireUserSession(req, res); if (!s) return;
    try {
      const r = await pool.query(`SELECT * FROM audio_releases WHERE review_project_id=$1::uuid AND owner_user_id=$2 ORDER BY created_at DESC LIMIT 1`, [str(req.params.id, 64), s.userId]);
      return res.json({ release: r.rows[0] || null });
    } catch (e) { if (isMissingTable(e)) return res.json({ release: null }); return res.status(500).json({ error: "release_get_failed" }); }
  });

  // ══ SPOTIFY ═══════════════════════════════════════════════════════════════
  const spotifyOff = (res: any) => res.status(503).json({ error: "spotify_unconfigured" });

  // Artist-søk (offentlig + rate-limitet — brukes også på offentlig profilside).
  app.get("/api/spotify/search-artist", async (req, res) => {
    if (rateLimited(`spa:${clientIp(req)}`, 40)) return res.status(429).json({ error: "rate_limited" });
    const q = str(req.query?.q, 120); if (!q) return res.json({ artists: [] });
    const d = await spotifyGet(`/search?q=${encodeURIComponent(q)}&type=artist&limit=6`);
    if (!d) return spotifyOff(res);
    return res.json({ artists: (d.artists?.items || []).map(spotifyArtistDTO) });
  });

  // Generelt søk for metadata-berikelse (track/artist/album).
  app.get("/api/spotify/search", async (req, res) => {
    if (rateLimited(`sps:${clientIp(req)}`, 40)) return res.status(429).json({ error: "rate_limited" });
    const q = str(req.query?.q, 160); if (!q) return res.json({ tracks: [], artists: [] });
    const type = ["track", "artist", "album"].includes(String(req.query?.type)) ? String(req.query.type) : "track";
    const d = await spotifyGet(`/search?q=${encodeURIComponent(q)}&type=${type}&limit=6`);
    if (!d) return spotifyOff(res);
    return res.json({
      tracks: (d.tracks?.items || []).map((t: any) => ({ id: t.id, name: t.name, url: t.external_urls?.spotify || null, artists: (t.artists || []).map((a: any) => a.name), album: t.album?.name || null, image: t.album?.images?.[0]?.url || null, releaseDate: t.album?.release_date || null, isrc: t.external_ids?.isrc || null })),
      artists: (d.artists?.items || []).map(spotifyArtistDTO),
    });
  });

  // Verifiser om en release er live på Spotify (ISRC → track, ev. UPC → album).
  app.get("/api/releases/:id/spotify-status", async (req, res) => {
    const s = requireUserSession(req, res); if (!s) return;
    try {
      const r = await pool.query(`SELECT isrc, upc, master_url FROM audio_releases WHERE id=$1::uuid AND owner_user_id=$2 LIMIT 1`, [str(req.params.id, 64), s.userId]);
      if (r.rowCount === 0) return res.status(404).json({ error: "not_found" });
      const rel = r.rows[0];
      if (!process.env.SPOTIFY_CLIENT_ID) return spotifyOff(res);
      const digits = (v: any) => String(v || "").replace(/\D/g, "");
      // ISRC er presis: søk gir tracken med external_ids.isrc — verifiser eksakt match.
      if (rel.isrc) {
        const norm = String(rel.isrc).replace(/[^a-z0-9]/gi, "").toUpperCase();
        const d = await spotifyGet(`/search?q=isrc:${encodeURIComponent(norm)}&type=track&limit=5`);
        const t = (d?.tracks?.items || []).find((x: any) => String(x.external_ids?.isrc || "").toUpperCase() === norm);
        if (t) return res.json({ live: true, by: "isrc", track: { id: t.id, name: t.name, url: t.external_urls?.spotify || null, album: t.album?.name || null, image: t.album?.images?.[0]?.url || null, releaseDate: t.album?.release_date || null, embedUrl: `https://open.spotify.com/embed/track/${t.id}` } });
      }
      // UPC-søk er fuzzy → hent kandidat-albumet og verifiser external_ids.upc eksakt.
      if (rel.upc) {
        const target = digits(rel.upc).replace(/^0+/, "");
        const d = await spotifyGet(`/search?q=upc:${encodeURIComponent(rel.upc)}&type=album&limit=3`);
        for (const cand of (d?.albums?.items || [])) {
          const full = await spotifyGet(`/albums/${cand.id}`);
          if (full && digits(full.external_ids?.upc).replace(/^0+/, "") === target && target) {
            return res.json({ live: true, by: "upc", album: { id: full.id, name: full.name, url: full.external_urls?.spotify || null, image: full.images?.[0]?.url || null, releaseDate: full.release_date || null, embedUrl: `https://open.spotify.com/embed/album/${full.id}` } });
          }
        }
      }
      return res.json({ live: false });
    } catch (e) { if (isMissingTable(e)) return res.status(503).json({ error: "migration_pending" }); return res.status(500).json({ error: "spotify_status_failed" }); }
  });
}
