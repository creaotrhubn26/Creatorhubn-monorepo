/**
 * Klient mot Lovdata API (https://api.lovdata.no) — offisiell, maskinlesbar kilde
 * til gjeldende lovtekst. Brukes til å forankre `legalReference`/lovtekst på reglene
 * i regelregisteret i den autoritative primærkilden i stedet for hukommelse.
 *
 * VIKTIG — TILGANGSMODELL (verifisert mot API-ets OpenAPI-spec + live-prober 2026-07-20):
 *  - ÅPENT, uten nøkkel (NLOD 2.0): `/ping`, `/version` og bulk-datasettene under
 *    `/v1/publicData/*` (bl.a. `gjeldende-lover.tar.bz2` = alle gjeldende lover).
 *  - KREVER API-NØKKEL (`X-API-Key`): per-dokument/paragraf-oppslag som
 *    `/renderRefID` og `/lookup` (401 uten nøkkel).
 *
 * Det betyr at «gratis, ingen nøkkel» kun gjelder bulk-datasettene. Selve
 * paragraf-oppslaget — som trengs for å hente teksten bak en enkelt `legalReference`
 * — krever en Lovdata-utstedt API-nøkkel. Uten nøkkel rapporteres dette ÆRLIG som
 * ikke aktivt (se `/api/integrations/status` og docs/integration-status.md), og
 * `fetchLegalText` kaster `LovdataAuthError` FØR den gjør et nettverkskall.
 *
 * AI/LLM er aldri kilde til tall eller juridisk innhold — denne klienten henter
 * ordrett tekst fra offisiell kilde. Satser bor uansett i det versjonerte
 * regelregisteret, ikke her.
 */

import type { RuleRegister } from '../rules/register.js';
import type { TaxRule } from '../rules/types.js';

/** Grunnfeil for alle Lovdata-kall. */
export class LovdataError extends Error {
  constructor(
    message: string,
    readonly status?: number,
  ) {
    super(message);
    this.name = 'LovdataError';
  }
}

/**
 * Manglende eller ugyldig API-nøkkel (HTTP 401), eller at et nøkkel-krevende
 * kall gjøres uten at nøkkel er konfigurert. Skilles ut fordi det er den
 * vanligste og mest håndterbare feilen: integrasjonen er ikke aktiv.
 */
export class LovdataAuthError extends LovdataError {
  constructor(message: string, status?: number) {
    super(message, status);
    this.name = 'LovdataAuthError';
  }
}

/** Gyldig nøkkel, men uten tilgang til akkurat dette dokumentet (HTTP 403). */
export class LovdataAccessError extends LovdataError {
  constructor(message: string, status?: number) {
    super(message, status);
    this.name = 'LovdataAccessError';
  }
}

/** Ett åpent bulk-datasett slik `/v1/publicData/list` beskriver det. */
export interface LovdataDataset {
  filename: string;
  description: string;
  /** Størrelse i bytes. */
  sizeBytes: number;
  /** ISO-tidsstempel for siste oppdatering. */
  lastModified: string;
}

/** Resultat av et paragraf-/dokumentoppslag. */
export interface LegalTextResult {
  /** Referansen det ble slått opp på (f.eks. `NL/lov/1999-03-26-14/§6-20`). */
  refID: string;
  /** Fantes referansen? (false ved 404.) */
  found: boolean;
  /** Ordrett lovtekst som HTML når found. Tom ved 404. */
  html: string;
  /** Rå, uparset svarkropp fra API-et, for sporbarhet/feilsøking. */
  raw: unknown;
}

export interface LovdataPort {
  /** Er en API-nøkkel konfigurert? Styrer ærlig statusrapportering. */
  readonly hasApiKey: boolean;
  /** Nås API-et? Bruker det åpne `/ping`-endepunktet — ingen nøkkel. */
  ping(): Promise<boolean>;
  /** Lister de åpne NLOD-bulkdatasettene. Ingen nøkkel. */
  listPublicDatasets(): Promise<LovdataDataset[]>;
  /**
   * Henter ordrett lovtekst for en referanse via `/renderRefID`.
   * KREVER API-nøkkel — kaster `LovdataAuthError` uten (før nettverkskall).
   */
  fetchLegalText(refID: string): Promise<LegalTextResult>;
}

type FetchLike = (
  url: string,
  init?: { signal?: AbortSignal; headers?: Record<string, string> },
) => Promise<{
  status: number;
  ok: boolean;
  json(): Promise<unknown>;
  text(): Promise<string>;
}>;

const LOVDATA_BASE_URL = 'https://api.lovdata.no';

export class LovdataApiClient implements LovdataPort {
  constructor(
    private readonly apiKey: string | undefined = undefined,
    private readonly fetchImpl: FetchLike = fetch as unknown as FetchLike,
    private readonly timeoutMs = 8000,
    private readonly baseUrl: string = LOVDATA_BASE_URL,
  ) {}

  get hasApiKey(): boolean {
    return typeof this.apiKey === 'string' && this.apiKey.length > 0;
  }

  async ping(): Promise<boolean> {
    // `/ping` er åpent (ingen nøkkel). Sender bevisst IKKE X-API-Key.
    try {
      const res = await this.request('/ping', { auth: false });
      if (res.status !== 200) return false;
      const body = (await res.text()).trim();
      return /pong/i.test(body);
    } catch {
      return false;
    }
  }

  async listPublicDatasets(): Promise<LovdataDataset[]> {
    // Åpent NLOD-katalogendepunkt — ingen nøkkel.
    const res = await this.request('/v1/publicData/list', { auth: false });
    if (!res.ok) {
      throw new LovdataError(`Lovdata publicData/list svarte med status ${res.status}.`, res.status);
    }
    const body = (await res.json()) as Array<{
      filename?: string;
      description?: string;
      sizeBytes?: string | number;
      lastModified?: string;
    }>;
    if (!Array.isArray(body)) {
      throw new LovdataError('Uventet svar fra Lovdata publicData/list (ikke en liste).');
    }
    return body.map((d) => ({
      filename: d.filename ?? '',
      description: d.description ?? '',
      sizeBytes: Number(d.sizeBytes ?? 0),
      lastModified: d.lastModified ?? '',
    }));
  }

  async fetchLegalText(refID: string): Promise<LegalTextResult> {
    if (!refID || refID.trim().length === 0) {
      throw new LovdataError('refID kan ikke være tom.');
    }
    if (!this.hasApiKey) {
      // Ærlig og tidlig: ingen nøkkel ⇒ ingen aktiv integrasjon. Gjør ikke
      // nettverkskall som uansett ville gitt 401.
      throw new LovdataAuthError(
        'Lovdata API-nøkkel (X-API-Key) er ikke konfigurert. Per-paragraf lovtekst-oppslag er ikke aktivt — sett REKNAREN_LOVDATA_API_KEY. Åpne bulk-datasett kan hentes uten nøkkel via listPublicDatasets().',
      );
    }
    const res = await this.request('/renderRefID', {
      auth: true,
      query: { refID, format: 'json' },
    });
    if (res.status === 401) {
      throw new LovdataAuthError('Lovdata avviste nøkkelen (401).', 401);
    }
    if (res.status === 403) {
      throw new LovdataAccessError(`Ingen tilgang til dokumentet ${refID} (403).`, 403);
    }
    if (res.status === 404) {
      return { refID, found: false, html: '', raw: null };
    }
    if (!res.ok) {
      throw new LovdataError(`Lovdata renderRefID svarte med status ${res.status}.`, res.status);
    }
    // format=json dokumenteres som «HTML pakket i et JSON-objekt». Den nøyaktige
    // konvolutten kan ikke verifiseres uten nøkkel, så vi parser defensivt: godta
    // ren streng eller objekt med et tekstfelt, og behold alltid rådataen.
    let raw: unknown;
    try {
      raw = await res.json();
    } catch {
      const text = await res.text();
      return { refID, found: true, html: text, raw: text };
    }
    return { refID, found: true, html: extractHtml(raw), raw };
  }

  private async request(
    path: string,
    opts: { auth: boolean; query?: Record<string, string> },
  ): Promise<Awaited<ReturnType<FetchLike>>> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      const qs = opts.query ? `?${new URLSearchParams(opts.query).toString()}` : '';
      const headers: Record<string, string> = { accept: 'application/json' };
      if (opts.auth && this.hasApiKey) headers['X-API-Key'] = this.apiKey as string;
      return await this.fetchImpl(`${this.baseUrl}${path}${qs}`, {
        signal: controller.signal,
        headers,
      });
    } finally {
      clearTimeout(timer);
    }
  }
}

/** Test-/sandboxstub: deterministiske svar uten nettverk. */
export class StaticLovdataStub implements LovdataPort {
  readonly hasApiKey: boolean;

  constructor(
    private readonly texts: Record<string, LegalTextResult> = {},
    private readonly datasets: LovdataDataset[] = [],
    opts: { hasApiKey?: boolean; reachable?: boolean } = {},
  ) {
    this.hasApiKey = opts.hasApiKey ?? true;
    this.reachable = opts.reachable ?? true;
  }

  private readonly reachable: boolean;

  async ping(): Promise<boolean> {
    return this.reachable;
  }

  async listPublicDatasets(): Promise<LovdataDataset[]> {
    return this.datasets;
  }

  async fetchLegalText(refID: string): Promise<LegalTextResult> {
    if (!this.hasApiKey) {
      throw new LovdataAuthError('Stub konfigurert uten API-nøkkel.');
    }
    return this.texts[refID] ?? { refID, found: false, html: '', raw: null };
  }
}

// ── refID-hjelpere ───────────────────────────────────────────────────────────
// Lovdata-referanser har formen `NL/lov/<dato-id>` (FRBR-basert), eventuelt med
// en paragraf lagt til. Vi utleder base-refID fra kildens lovdata.no-URL (som
// bærer nøyaktig samme sti) og bygger paragraf-referanser etter Lovdatas
// §-notasjon. Strengbyggingen er deterministisk og testes direkte; endelig
// oppslag mot API-et krever nøkkel.

const LOVDATA_URL_PATH = /lovdata\.no\/dokument\/(NL\/(?:lov|forskrift)\/[0-9-]+)/i;

/**
 * Utleder base-refID (f.eks. `NL/lov/1999-03-26-14`) fra en lovdata.no-dokument-URL.
 * Returnerer null hvis URL-en ikke er en gjenkjennelig lovdokument-URL.
 */
export function lawRefIDFromUrl(url: string): string | null {
  const m = LOVDATA_URL_PATH.exec(url);
  return m ? m[1]! : null;
}

/** Normaliserer en paragrafstreng («§ 6-20», «6-20», «6-20 (antatt)») til `§6-20`. */
export function normalizeParagraph(paragraph: string): string | null {
  const m = /(\d+[a-z]?(?:-\d+[a-z]?)?)/i.exec(paragraph.replace(/§/g, ' '));
  return m ? `§${m[1]}` : null;
}

/**
 * Bygger en refID for en lov, eventuelt ned til paragraf.
 * `buildLawRefID('NL/lov/1999-03-26-14', '§ 6-20')` → `NL/lov/1999-03-26-14/§6-20`.
 */
export function buildLawRefID(base: string, paragraph?: string): string {
  if (!paragraph) return base;
  const p = normalizeParagraph(paragraph);
  return p ? `${base}/${p}` : base;
}

/**
 * Kobler en regel i regelregisteret til en Lovdata-refID for paragrafen bak
 * `legalReference`. Finner regelens første 'lov'-kilde med lovdata.no-URL, utleder
 * base-refID og legger på paragrafen fra `legalReference`. Returnerer null når
 * regelen mangler lovkilde eller lesbar paragraf — motoren gjetter aldri.
 *
 * Dette er broen som gjør at `legalReference` kan fylles/verifiseres fra offisiell
 * kilde: refID-en herfra mates rett inn i `LovdataPort.fetchLegalText`.
 */
export function legalReferenceRefID(rule: TaxRule, register: RuleRegister): string | null {
  for (const sid of rule.sourceIds) {
    const source = register.getSource(sid);
    if (source.type !== 'lov') continue;
    const base = lawRefIDFromUrl(source.url);
    if (!base) continue;
    return buildLawRefID(base, rule.legalReference);
  }
  return null;
}

/** Best-effort uttrekk av en HTML/tekst-streng fra en ukjent JSON-konvolutt. */
function extractHtml(raw: unknown): string {
  if (typeof raw === 'string') return raw;
  if (raw && typeof raw === 'object') {
    for (const key of ['html', 'content', 'text', 'body']) {
      const v = (raw as Record<string, unknown>)[key];
      if (typeof v === 'string') return v;
    }
  }
  return '';
}
