/**
 * Enable Banking Payment Initiation (PIS) — ekte «betal fakturaen» / send til nettbank.
 * Bruker samme selv-signerte RS256-JWT-auth som konto-informasjons-provideren
 * (`bankFeedEnable`-creds). Uten creds: ærlig inaktiv. Sender ALDRI penger uten at
 * brukeren godkjenner i banken (BankID) via den returnerte auth-URL-en.
 *
 * ⚠️ Payload-formen følger Enable Banking sin PIS-dok, men MÅ verifiseres mot deres
 * sandbox før prod-bruk (samme forsiktighet som MVA-submit). `configured=false` inntil da.
 */
import { EB_BASE, type EnableBankingConfig, signEnableJwt } from '../bank/feed.js';

type FetchLike = (
  url: string,
  init: { method: string; headers: Record<string, string>; body?: string; signal?: AbortSignal },
) => Promise<{ status: number; ok: boolean; json(): Promise<unknown>; text(): Promise<string> }>;

export interface PaymentInitiationInput {
  aspspName: string;           // bankens navn hos Enable Banking (samme id som konto-koblingen)
  creditorName: string;        // leverandøren
  creditorIban?: string;
  creditorBban?: string;       // norsk kontonummer når IBAN mangler
  amountMinor: bigint;         // øre
  currency: string;            // 'NOK'
  kid?: string;                // strukturert KID-referanse
  message?: string;            // fri melding når KID mangler
  debtorIban?: string;         // betalers konto (valgfritt)
  redirectUrl: string;         // hvor banken sender brukeren tilbake
  state: string;               // vår referanse
  /**
   * Enable Banking PaymentType. ⚠️ Riktig verdi for norsk innenlands NOK-betaling MÅ
   * bekreftes mot Enable Banking sandbox / support (ikke i offentlig doc). «SEPA» gjelder
   * kun EUR. Antatt NO-verdi under; overstyr til bekreftet verdi før prod.
   * ponytail: gjettet default, bekreft mot sandbox før live.
   */
  paymentType?: string;
}

/** Øre (bigint) → «12.34» uten flyttall. */
export function minorToAmountString(minor: bigint, _currency: string): string {
  const neg = minor < 0n;
  const abs = neg ? -minor : minor;
  const kroner = abs / 100n;
  const ore = abs % 100n;
  return `${neg ? '-' : ''}${kroner.toString()}.${ore.toString().padStart(2, '0')}`;
}

/**
 * Bygger PIS-request-body etter Enable Bankings faktiske schema (verifisert mot deres
 * Create Payment-eksempel): `creditor`/`creditor_account` ligger under `beneficiary`,
 * `creditor_account` er flat `{scheme_name, identification}`, KID sendes som
 * `reference_number`, og `payment_type` er påkrevd på toppnivå. Ren funksjon → testbar.
 */
export function buildPaymentRequest(input: PaymentInitiationInput): Record<string, unknown> {
  const creditorAccount = input.creditorIban
    ? { scheme_name: 'IBAN', identification: input.creditorIban }
    : { scheme_name: 'BBAN', identification: (input.creditorBban ?? '').replace(/\s/g, '') };
  const tx: Record<string, unknown> = {
    instructed_amount: { amount: minorToAmountString(input.amountMinor, input.currency), currency: input.currency },
    beneficiary: {
      creditor: { name: input.creditorName },
      creditor_account: creditorAccount,
    },
  };
  if (input.kid) {
    tx.reference_number = input.kid;             // strukturert KID
  } else if (input.message) {
    tx.remittance_information = [input.message]; // fri melding
  }
  return {
    // ⚠️ NOK-verdi må bekreftes mot sandbox/EB (se PaymentInitiationInput.paymentType).
    payment_type: input.paymentType ?? 'NORWEGIAN_DOMESTIC_CREDIT_TRANSFER',
    payment_request: {
      credit_transfer_transaction: [tx],
      ...(input.debtorIban ? { debtor_account: { scheme_name: 'IBAN', identification: input.debtorIban } } : {}),
    },
    aspsp: { name: input.aspspName, country: 'NO' },
    psu_type: 'business',
    state: input.state,
    redirect_url: input.redirectUrl,
  };
}

export interface PaymentInitiationPort {
  readonly configured: boolean;
  /** Starter en betaling → auth-URL brukeren godkjenner i banken (BankID). */
  initiatePayment(input: PaymentInitiationInput): Promise<{ authUrl: string; paymentId: string }>;
}

export class EnableBankingPaymentInitiation implements PaymentInitiationPort {
  private readonly cfg: EnableBankingConfig | undefined;
  private readonly fetchImpl: FetchLike;
  private readonly now: () => number;

  constructor(cfg: EnableBankingConfig | undefined, fetchImpl: FetchLike = fetch as unknown as FetchLike, now: () => number = () => Math.floor(Date.now() / 1000)) {
    this.cfg = cfg;
    this.fetchImpl = fetchImpl;
    this.now = now;
  }

  get configured(): boolean {
    return Boolean(this.cfg?.applicationId && this.cfg?.privateKeyPem);
  }

  async initiatePayment(input: PaymentInitiationInput): Promise<{ authUrl: string; paymentId: string }> {
    if (!this.cfg || !this.configured) {
      throw new Error('Betaling via bank er ikke aktivert (Enable Banking PIS mangler konfig).');
    }
    const res = await this.fetchImpl(`${EB_BASE}/payments`, {
      method: 'POST',
      headers: {
        accept: 'application/json',
        'content-type': 'application/json',
        authorization: `Bearer ${signEnableJwt(this.cfg, this.now())}`,
      },
      body: JSON.stringify(buildPaymentRequest(input)),
    });
    if (!res.ok) {
      const detail = await res.text().catch(() => '');
      throw new Error(`Enable Banking PIS svarte ${res.status}. ${detail.slice(0, 200)}`);
    }
    const body = (await res.json()) as { url?: string; payment_id?: string; authorization_id?: string };
    if (!body.url) throw new Error('Enable Banking PIS returnerte ingen godkjennings-URL.');
    return { authUrl: body.url, paymentId: body.payment_id ?? body.authorization_id ?? '' };
  }
}
