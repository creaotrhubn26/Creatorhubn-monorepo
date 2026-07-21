/**
 * MVA-melding-innsending mot Skatteetaten — lukker `vat.submit`-gapet i kode
 * (MVA-rapporten er i dag alltid `status: 'draft'`).
 *
 * Flyt (verifisert mot skatteetaten.github.io/mva-meldingen 2026-07-20):
 *  1. Maskinporten access-token (scope skatteetaten:mvameldinginnsending) —
 *     se `MaskinportenPort`.
 *  2. Validering: POST `<base>/api/mva/grensesnittstoette/mva-melding/valider`
 *     med mva-melding-XML (namespace no:skatteetaten:fastsetting:avgift:mva:…v1.0)
 *     → tilbakemelding (utfall + avvik).
 *  3. Innsending: Altinn 3-app `skd/mva-melding-innsending` (opprett instans,
 *     last opp melding + konvolutt, fullfør).
 *
 * ÆRLIG STATUS: Ikke aktiv uten Maskinporten-legitimasjon (`MaskinportenPort.configured`).
 * `validate`/`submit` kaster `MaskinportenAuthError` FØR nettverkskall uten token.
 * XML-bygging er et MVP-SKJELETT som MÅ valideres mot Skatteetatens offisielle
 * XSD (referert i docs, ennå ikke vendored) før reell innsending — nettopp derfor
 * går alt gjennom `validate` først, som returnerer skjemaavvik fra kilden.
 *
 * Penger holdes som bigint øre helt til XML-formatering; ingen flyttall i kjeden.
 */

import type { VatReport } from '../vat/engine.js';
import type { MaskinportenEnv, MaskinportenPort } from './maskinporten.js';
import { MaskinportenAuthError, MaskinportenError } from './maskinporten.js';

/** Miljøspesifikke baser. Test-hostene er verifisert; prod må bekreftes før bruk. */
export const VAT_SUBMISSION_ENDPOINTS: Record<
  MaskinportenEnv,
  { validateBase: string; altinnPlatform: string; altinnApp: string }
> = {
  test: {
    validateBase: 'https://idporten-api-sbstest.sits.no',
    altinnPlatform: 'https://platform.tt02.altinn.no',
    altinnApp: 'https://skd.apps.tt02.altinn.no/skd/mva-melding-innsending',
  },
  prod: {
    // NB: prod-host må bekreftes mot Skatteetaten før produksjonsbruk.
    validateBase: 'https://idporten-api.sits.no',
    altinnPlatform: 'https://platform.altinn.no',
    altinnApp: 'https://skd.apps.altinn.no/skd/mva-melding-innsending',
  },
};

export interface VatValidationResult {
  /** Godkjent uten avvik? */
  valid: boolean;
  /** Avvik/feilmeldinger fra valideringstjenesten. */
  messages: string[];
  /** Rå svarkropp for sporbarhet. */
  raw: unknown;
}

export interface VatSubmissionReceipt {
  /** Referanse fra innsendingen (Altinn-instans-id e.l.). */
  reference: string;
  status: string;
  submittedAt: string;
}

export interface VatSubmissionPort {
  /** Er innsending aktiv? (Maskinporten konfigurert.) */
  readonly active: boolean;
  /** Miljøet det sendes mot ('test'/'prod'). */
  readonly env: MaskinportenEnv;
  /** Validerer mva-meldingen mot Skatteetatens grensesnittstøtte. Krever token. */
  validate(report: VatReport): Promise<VatValidationResult>;
  /** Sender inn mva-meldingen via Altinn 3. Krever token + autorisert virksomhet. */
  submit(report: VatReport): Promise<VatSubmissionReceipt>;
}

type FetchLike = (
  url: string,
  init: {
    method: string;
    headers: Record<string, string>;
    body?: string;
    signal?: AbortSignal;
  },
) => Promise<{ status: number; ok: boolean; json(): Promise<unknown>; text(): Promise<string> }>;

const MVA_NS = 'no:skatteetaten:fastsetting:avgift:mva:skattemeldingformerverdiavgift:v1.0';

/** Formaterer bigint øre til desimalkroner (eksakt, uten flyttall). */
function minorToKroner(minor: bigint): string {
  const neg = minor < 0n;
  const abs = neg ? -minor : minor;
  const kr = abs / 100n;
  const ore = abs % 100n;
  return `${neg ? '-' : ''}${kr}.${ore.toString().padStart(2, '0')}`;
}

/**
 * MVP-SKJELETT for mva-melding-XML fra en `VatReport`. Bygger konvolutten i riktig
 * namespace med linjer per mva-melding-kode. MÅ valideres mot Skatteetatens XSD før
 * reell innsending — valideringstjenesten (`validate`) er nettopp den kontrollen.
 * Eksportert for testbarhet.
 */
export function buildMvaMeldingXml(report: VatReport): string {
  const lines = report.lines
    .map(
      (l) =>
        `    <mvaLinje kode="${escapeXml(l.mvaMeldingCode)}">` +
        `<grunnlag>${minorToKroner(l.baseMinor)}</grunnlag>` +
        `<merverdiavgift>${minorToKroner(l.vatMinor)}</merverdiavgift>` +
        `</mvaLinje>`,
    )
    .join('\n');
  return (
    `<?xml version="1.0" encoding="UTF-8"?>\n` +
    `<mvaMeldingDto xmlns="${MVA_NS}">\n` +
    `  <periode><fra>${report.fromDate}</fra><til>${report.toDate}</til></periode>\n` +
    `  <mvaLinjer>\n${lines}\n  </mvaLinjer>\n` +
    `  <sumBetalbar>${minorToKroner(report.netPayableMinor)}</sumBetalbar>\n` +
    `</mvaMeldingDto>`
  );
}

function escapeXml(s: string): string {
  return s.replace(/[<>&"']/g, (c) =>
    ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&apos;' })[c] as string,
  );
}

export class SkatteetatenVatSubmissionClient implements VatSubmissionPort {
  private readonly ep: (typeof VAT_SUBMISSION_ENDPOINTS)[MaskinportenEnv];

  constructor(
    private readonly maskinporten: MaskinportenPort,
    private readonly fetchImpl: FetchLike = fetch as unknown as FetchLike,
    private readonly timeoutMs = 15000,
    endpoints: (typeof VAT_SUBMISSION_ENDPOINTS)[MaskinportenEnv] = VAT_SUBMISSION_ENDPOINTS[
      maskinporten.env
    ],
  ) {
    this.ep = endpoints;
  }

  get active(): boolean {
    return this.maskinporten.configured;
  }

  get env(): MaskinportenEnv {
    return this.maskinporten.env;
  }

  async validate(report: VatReport): Promise<VatValidationResult> {
    const token = await this.token(); // kaster MaskinportenAuthError uten legitimasjon
    const xml = buildMvaMeldingXml(report);
    const res = await this.call(
      `${this.ep.validateBase}/api/mva/grensesnittstoette/mva-melding/valider`,
      {
        method: 'POST',
        headers: {
          authorization: `Bearer ${token}`,
          'content-type': 'application/xml',
          accept: 'application/json',
        },
        body: xml,
      },
    );
    const raw = await safeJson(res);
    const messages = extractMessages(raw);
    return { valid: res.ok && messages.length === 0, messages, raw };
  }

  async submit(_report: VatReport): Promise<VatSubmissionReceipt> {
    // Sikrer token/legitimasjon først (ærlig: feiler tidlig uten Maskinporten).
    await this.token();
    // Innsending krever en autorisert virksomhet og full Altinn 3-instansflyt
    // (opprett instans → last opp melding + konvolutt → fullfør) mot
    // `${this.ep.altinnApp}`. Denne kan ikke verifiseres uten legitimasjon og et
    // test-organisasjonsnummer, og markeres derfor eksplisitt som ikke ferdigstilt
    // heller enn å returnere en falsk kvittering.
    throw new MaskinportenError(
      `Innsending mot Altinn 3 (${this.ep.altinnApp}) er ikke ferdig implementert: krever autorisert virksomhet og instansflyt. Valider meldingen med validate() i mellomtiden.`,
    );
  }

  private async token(): Promise<string> {
    const t = await this.maskinporten.getAccessToken();
    return t.accessToken;
  }

  private async call(url: string, init: Parameters<FetchLike>[1]) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      return await this.fetchImpl(url, { ...init, signal: controller.signal });
    } finally {
      clearTimeout(timer);
    }
  }
}

/** Test-/sandboxstub: deterministisk validering/innsending uten nettverk. */
export class StubVatSubmission implements VatSubmissionPort {
  readonly active: boolean;
  readonly env: MaskinportenEnv;

  constructor(
    private readonly result: VatValidationResult = { valid: true, messages: [], raw: null },
    private readonly receipt: VatSubmissionReceipt | null = null,
    opts: { active?: boolean; env?: MaskinportenEnv } = {},
  ) {
    this.active = opts.active ?? true;
    this.env = opts.env ?? 'test';
  }

  async validate(_report: VatReport): Promise<VatValidationResult> {
    if (!this.active) throw new MaskinportenAuthError('Stub uten Maskinporten-legitimasjon.');
    return this.result;
  }

  async submit(_report: VatReport): Promise<VatSubmissionReceipt> {
    if (!this.active) throw new MaskinportenAuthError('Stub uten Maskinporten-legitimasjon.');
    if (!this.receipt) throw new MaskinportenError('Stub har ingen innsendingskvittering konfigurert.');
    return this.receipt;
  }
}

// Re-eksporter for bekvem import i wiring/tester.
export { MaskinportenError };

async function safeJson(res: { json(): Promise<unknown>; text(): Promise<string> }): Promise<unknown> {
  try {
    return await res.json();
  } catch {
    try {
      return await res.text();
    } catch {
      return null;
    }
  }
}

function extractMessages(raw: unknown): string[] {
  if (raw && typeof raw === 'object') {
    const r = raw as Record<string, unknown>;
    for (const key of ['messages', 'valideringsfeil', 'errors', 'avvik']) {
      const v = r[key];
      if (Array.isArray(v)) return v.map((x) => (typeof x === 'string' ? x : JSON.stringify(x)));
    }
  }
  return [];
}
