/**
 * MVA-melding mot Skatteetaten.
 *
 * 🔴 VIKTIG AUTENTISERINGS-FUNN (2026-07-30, verifisert mot ekte prod-endepunkt +
 * skatteetaten.github.io/mva-meldingen/documentation/implementasjonsguide):
 * Skatteetatens validerings- OG innsendings-API-er (idporten.api.skatteetaten.no)
 * krever **ID-PORTEN-token** — en pålogget SLUTTBRUKER (BankID, OIDC authorization-
 * code-flyt) — IKKE Maskinporten (maskin-til-maskin). Denne klassen ble bygd rundt
 * Maskinporten og får derfor **401** mot valideringstjenesten selv med gyldig
 * Maskinporten-token for scope skatteetaten:mvameldingvalidering. For å ta i bruk
 * API-ene på ekte må det bygges en ID-porten-innlogging (egen ID-porten-klient i
 * Samarbeidsportalen m/ redirect-URL + token-cache), og validate/submit må bruke
 * ID-porten-aksesstokenet. Til da: last ned XSD-gyldig XML og last opp i Altinn.
 *
 * XML-byggingen (`buildMvaMeldingXml`) er derimot korrekt og XSD-validert (se
 * test/vat-submission.test.ts mot vendor/mva/…v1.0.xsd) og gjenbrukes uansett
 * auth-vei. VAT_SUBMISSION_ENDPOINTS er nå bekreftede prod/test-hoster.
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
    // Bekreftet mot skatteetaten.github.io/api-dokumentasjon/api/mvameldingvalidering.
    validateBase: 'https://idporten-api-test.sits.no',
    altinnPlatform: 'https://platform.tt02.altinn.no',
    // 🔑 app-ID (evt. -etmN-suffiks) bekreftes mot TT02 ved første testkjøring.
    altinnApp: 'https://skd.apps.tt02.altinn.no/skd/mva-melding-innsending-etm2',
  },
  prod: {
    // Bekreftet: valideringstjenesten ligger på idporten.api.skatteetaten.no.
    validateBase: 'https://idporten.api.skatteetaten.no',
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
  validate(report: VatReport, options: { orgNumber: string }): Promise<VatValidationResult>;
  /** Sender inn mva-meldingen via Altinn 3. Krever token + autorisert virksomhet. */
  submit(report: VatReport, options: { orgNumber: string }): Promise<VatSubmissionReceipt>;
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

/** Runder bigint øre til HELE kroner (mva-meldingen bruker heltall kr), half-away-from-zero. */
function roundToKroner(minor: bigint): bigint {
  const neg = minor < 0n;
  const abs = neg ? -minor : minor;
  const kr = (abs + 50n) / 100n;
  return neg ? -kr : kr;
}

/** Utleder terminnavnet (skattleggingsperiodeToMaaneder) + år fra rapportperioden. */
const TWO_MONTH_TERMS = ['januar-februar', 'mars-april', 'mai-juni', 'juli-august', 'september-oktober', 'november-desember'];
function periodeElement(fromDate: string): string {
  const month = Number(fromDate.slice(5, 7));
  const term = TWO_MONTH_TERMS[Math.floor((month - 1) / 2)] ?? 'januar-februar';
  return `<periode><skattleggingsperiodeToMaaneder>${term}</skattleggingsperiodeToMaaneder></periode><aar>${fromDate.slice(0, 4)}</aar>`;
}

export interface MvaMeldingOptions {
  /** Virksomhetens organisasjonsnummer (9 sifre) — påkrevd i <skattepliktig>. */
  orgNumber: string;
  /** Unik referanse for innsendingen fra vårt system. Default utledes fra perioden. */
  reference?: string;
  /** Programvareversjon (<regnskapssystem>). */
  systemVersion?: string;
}

/**
 * Bygger mva-melding-XML fra en `VatReport`, i tråd med Skatteetatens offisielle
 * XSD `no.skatteetaten.fastsetting.avgift.mva.skattemeldingformerverdiavgift.v1.0`
 * (vendored i vendor/mva/, XSD-validert i test). Beløp i HELE kroner (heltall).
 * `grunnlag`/`sats` tas med når linja har et grunnlag (base ≠ 0); begge er valgfrie
 * i skjemaet, så XML-en er alltid XSD-gyldig — `validate()` mot Skatteetatens
 * grensesnittstøtte er den semantiske fasiten før innsending. Eksportert for test.
 */
export function buildMvaMeldingXml(report: VatReport, opts: MvaMeldingOptions): string {
  if (!/^\d{9}$/.test(opts.orgNumber)) {
    throw new MaskinportenError('Organisasjonsnummer (9 sifre) mangler på virksomheten — kreves i mva-meldingen.');
  }
  const reference = opts.reference ?? `Reknaren-${report.fromDate}-${report.toDate}`;
  let fastsattKroner = 0n;
  const spesifikasjonslinjer = report.lines
    .map((l) => {
      const vatKr = roundToKroner(l.vatMinor);
      const baseKr = roundToKroner(l.baseMinor);
      fastsattKroner += vatKr;
      const parts = [`<mvaKode>${escapeXml(l.mvaMeldingCode)}</mvaKode>`];
      if (l.name) parts.push(`<mvaKodeRegnskapsystem>${escapeXml(l.name)}</mvaKodeRegnskapsystem>`);
      if (l.baseMinor !== 0n) {
        parts.push(`<grunnlag>${baseKr.toString()}</grunnlag>`);
        // sats utledes av forholdet mva/grunnlag (25/15/12/0). Streng i skjemaet.
        const sats = baseKr !== 0n ? ((vatKr < 0n ? -vatKr : vatKr) * 100n + (baseKr < 0n ? -baseKr : baseKr) / 2n) / (baseKr < 0n ? -baseKr : baseKr) : 0n;
        parts.push(`<sats>${sats.toString()}</sats>`);
      }
      parts.push(`<merverdiavgift>${vatKr.toString()}</merverdiavgift>`);
      return `      <mvaSpesifikasjonslinje>${parts.join('')}</mvaSpesifikasjonslinje>`;
    })
    .join('\n');
  return (
    `<?xml version="1.0" encoding="UTF-8"?>\n` +
    `<mvaMeldingDto xmlns="${MVA_NS}">\n` +
    `  <innsending>\n` +
    `    <regnskapssystemsreferanse>${escapeXml(reference)}</regnskapssystemsreferanse>\n` +
    `    <regnskapssystem><systemnavn>Reknaren</systemnavn><systemversjon>${escapeXml(opts.systemVersion ?? '1.0')}</systemversjon></regnskapssystem>\n` +
    `  </innsending>\n` +
    `  <skattegrunnlagOgBeregnetSkatt>\n` +
    `    <skattleggingsperiode>${periodeElement(report.fromDate)}</skattleggingsperiode>\n` +
    `    <fastsattMerverdiavgift>${fastsattKroner.toString()}</fastsattMerverdiavgift>\n` +
    `${spesifikasjonslinjer}\n` +
    `  </skattegrunnlagOgBeregnetSkatt>\n` +
    `  <betalingsinformasjon/>\n` +
    `  <skattepliktig><organisasjonsnummer>${opts.orgNumber}</organisasjonsnummer></skattepliktig>\n` +
    `  <meldingskategori>alminnelig</meldingskategori>\n` +
    `</mvaMeldingDto>`
  );
}

function escapeXml(s: string): string {
  return s.replace(/[<>&"']/g, (c) =>
    ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&apos;' })[c] as string,
  );
}

const INNSENDING_NS = 'no:skatteetaten:fastsetting:avgift:mva:mvameldinginnsending:v1.0';

/**
 * Innsendings-konvolutten (MvaMeldingInnsending). MINIMALT SKJELETT — declarerer
 * innsendingstype + periode. Eksakt schema bekreftes mot TT02 ved første kjøring;
 * `validate()` og feedback fra Skatteetaten er fasit.
 */
export function buildInnsendingXml(report: VatReport): string {
  return (
    `<?xml version="1.0" encoding="UTF-8"?>\n` +
    `<mvaMeldingInnsending xmlns="${INNSENDING_NS}">\n` +
    `  <innsendingstype>komplett</innsendingstype>\n` +
    `  <periode><fra>${report.fromDate}</fra><til>${report.toDate}</til></periode>\n` +
    `</mvaMeldingInnsending>`
  );
}

interface AltinnInstance {
  id?: string;
  data?: Array<{ id?: string; dataType?: string }>;
}

/** Finner data-elementets id i en Altinn-instans etter dataType (case-insensitivt). */
function findDataElementId(instance: AltinnInstance | null, dataType: string): string | undefined {
  const el = (instance?.data ?? []).find((e) => (e.dataType ?? '').toLowerCase() === dataType.toLowerCase());
  return el?.id;
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

  async validate(report: VatReport, options: { orgNumber: string }): Promise<VatValidationResult> {
    const token = await this.token(); // kaster MaskinportenAuthError uten legitimasjon
    const xml = buildMvaMeldingXml(report, options);
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

  /**
   * Sender inn mva-meldingen via Altinn 3-appen (skd/mva-melding-innsending):
   *  1) veksle Maskinporten-token → Altinn-token
   *  2) opprett instans (eier = virksomheten)
   *  3) last opp mva-melding + innsendings-konvolutt (+ evt. vedlegg)
   *  4) fullfør prosessen (process/next ×2)
   *  5) hent Skatteetatens kvittering (feedback)
   *
   * 🔑 Kall-sekvensen og endepunktene er fra Skatteetatens API-dok. De EKSAKTE
   * payload-formene (konvoluttens XML, dataType-navn) bekreftes ved første kjøring
   * mot TT02 — derfor `validate()` som fasit på XML-en underveis.
   */
  async submit(report: VatReport, options: { orgNumber: string }): Promise<VatSubmissionReceipt> {
    const mpToken = await this.token(); // Maskinporten (kaster uten legitimasjon)
    const altinnToken = await this.exchangeToken(mpToken);
    const auth = { authorization: `Bearer ${altinnToken}` };
    const app = this.ep.altinnApp;

    // 1) Opprett instans — eier er virksomheten meldingen gjelder.
    const created = await this.call(`${app}/instances`, {
      method: 'POST',
      headers: { ...auth, 'content-type': 'application/json', accept: 'application/json' },
      body: JSON.stringify({ instanceOwner: { organisationNumber: options.orgNumber } }),
    });
    if (!created.ok) throw new MaskinportenError(`Klarte ikke å opprette Altinn-instans (${created.status}).`);
    const instance = (await safeJson(created)) as AltinnInstance;
    const instanceId = instance?.id; // «{partyId}/{instanceGuid}»
    if (!instanceId) throw new MaskinportenError('Altinn returnerte ingen instans-id.');
    const instanceUrl = `${app}/instances/${instanceId}`;

    // 2) Last opp selve mva-meldingen.
    const upMelding = await this.call(`${instanceUrl}/data?dataType=mvamelding`, {
      method: 'POST',
      headers: { ...auth, 'content-type': 'application/xml' },
      body: buildMvaMeldingXml(report, options),
    });
    if (!upMelding.ok) throw new MaskinportenError(`Opplasting av mva-melding feilet (${upMelding.status}).`);

    // 3) Last opp innsendings-konvolutten. Data-elementet er forhåndsopprettet av
    //    appen; finnes det, PUT-er vi innholdet, ellers POST-er vi et nytt.
    const envId = findDataElementId(instance, 'mvameldinginnsending');
    const envXml = buildInnsendingXml(report);
    if (envId) {
      await this.call(`${instanceUrl}/data/${envId}`, {
        method: 'PUT',
        headers: { ...auth, 'content-type': 'application/xml' },
        body: envXml,
      });
    } else {
      await this.call(`${instanceUrl}/data?dataType=mvameldinginnsending`, {
        method: 'POST',
        headers: { ...auth, 'content-type': 'application/xml' },
        body: envXml,
      });
    }

    // 4) Fullfør: to prosess-steg (fullfør opplasting → fullfør innsending).
    await this.call(`${instanceUrl}/process/next`, { method: 'PUT', headers: { ...auth, accept: 'application/json' } });
    await this.call(`${instanceUrl}/process/next`, { method: 'PUT', headers: { ...auth, accept: 'application/json' } });

    // 5) Hent Skatteetatens kvittering (synkron feedback).
    const fb = await this.call(`${instanceUrl}/feedback/status`, { method: 'GET', headers: { ...auth, accept: 'application/json' } });
    const fbRaw = await safeJson(fb);
    const status =
      (fbRaw && typeof fbRaw === 'object' && typeof (fbRaw as Record<string, unknown>)['status'] === 'string'
        ? ((fbRaw as Record<string, unknown>)['status'] as string)
        : fb.ok
          ? 'submitted'
          : 'pending');

    return { reference: instanceId, status, submittedAt: new Date().toISOString() };
  }

  /** Veksler et Maskinporten-token til et Altinn-token (Altinn 3 platform). */
  private async exchangeToken(maskinportenToken: string): Promise<string> {
    const testFlag = this.maskinporten.env === 'test' ? '?test=true' : '';
    const res = await this.call(`${this.ep.altinnPlatform}/authentication/api/v1/exchange/maskinporten${testFlag}`, {
      method: 'GET',
      headers: { authorization: `Bearer ${maskinportenToken}`, accept: 'application/json' },
    });
    if (!res.ok) throw new MaskinportenError(`Altinn-token-veksling feilet (${res.status}).`);
    const body = (await res.text()).trim();
    return body.replace(/^"|"$/g, ''); // Altinn returnerer token som (evt. sitert) streng
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

  async validate(_report: VatReport, _options: { orgNumber: string }): Promise<VatValidationResult> {
    if (!this.active) throw new MaskinportenAuthError('Stub uten Maskinporten-legitimasjon.');
    return this.result;
  }

  async submit(_report: VatReport, _options: { orgNumber: string }): Promise<VatSubmissionReceipt> {
    if (!this.active) throw new MaskinportenAuthError('Stub uten Maskinporten-legitimasjon.');
    if (!this.receipt) throw new MaskinportenError('Stub har ingen innsendingskvittering konfigurert.');
    return this.receipt;
  }
}

// Re-eksporter for bekvem import i wiring/tester.
export { MaskinportenError };

/**
 * Validerer en mva-melding mot Skatteetatens grensesnittstøtte med et FERDIG
 * access-token (ID-porten). Bygger XML og POST-er den; tolker svaret likt som
 * klienten. Dette er auth-vei-agnostisk: kalleren skaffer tokenet (ID-porten).
 */
export async function validateMvaMeldingWithToken(params: {
  report: VatReport;
  orgNumber: string;
  accessToken: string;
  env: MaskinportenEnv;
  fetchImpl?: FetchLike;
}): Promise<VatValidationResult> {
  const ep = VAT_SUBMISSION_ENDPOINTS[params.env];
  const xml = buildMvaMeldingXml(params.report, { orgNumber: params.orgNumber });
  const doFetch = params.fetchImpl ?? (fetch as unknown as FetchLike);
  const res = await doFetch(`${ep.validateBase}/api/mva/grensesnittstoette/mva-melding/valider`, {
    method: 'POST',
    headers: { authorization: `Bearer ${params.accessToken}`, 'content-type': 'application/xml', accept: 'application/json' },
    body: xml,
  });
  const raw = await safeJson(res);
  const messages = extractMessages(raw);
  return { valid: res.ok && messages.length === 0, messages, raw };
}

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
