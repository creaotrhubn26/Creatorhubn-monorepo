/**
 * role-room-signing-provider.ts
 *
 * Leverandør-grensesnitt for e-signering med BankID (Del A punkt 42).
 *
 * **Hvorfor en abstraksjon og ikke en integrasjon:** beslutningsnotatet
 * (THE-ROLE-ROOM-BANKID-BESLUTNINGSNOTAT.md § 8) slår fast at leverandør
 * «velges først etter sammenligning», med RFQ til Idura, Signicat og Scrive,
 * og produksjon først ved 10 ekte brukere. Notatet advarer eksplisitt mot å
 * låse seg til én leverandør før man har tall.
 *
 * Å hardkode én leverandør nå ville foregripe den beslutningen. Sømmen her
 * gjør valget til en adapter på ~150 linjer framfor en ombygging: resten av
 * produktet — kontraktsflyt, foresatt-samtykke, statusvisning — kan bygges og
 * testes ferdig mot stub-adapteren i mellomtiden. Det er også nøyaktig
 * «Fase 0 — prototyp» i notatets utrullingsplan.
 *
 * Når leverandør er valgt: implementer SigningProvider, registrer den i
 * PROVIDERS, og sett RR_SIGNING_PROVIDER. Ingen kallsteder endres.
 */

export interface SignerRequest {
  fullName: string;
  email?: string | null;
  /** Foresatt som signerer for mindreårig — hovedgrunnen til at vi signerer. */
  signsOnBehalfOf?: string | null;
  /** Lik verdi = kan signere parallelt. */
  signOrder?: number;
}

export interface CreateOrderRequest {
  title: string;
  documentUrl?: string | null;
  documentSha256?: string | null;
  signers: SignerRequest[];
  expiresAt?: string | null;
  /** Vår id — sendes med så leverandørens callback kan kobles tilbake. */
  reference: string;
}

export interface CreatedOrder {
  providerOrderId: string;
  /** Per signatar: hvor de skal for å signere. */
  signerLinks: Array<{ fullName: string; url: string; providerSignerId: string }>;
}

export interface ProviderSignerStatus {
  providerSignerId: string;
  status: "pending" | "sent" | "signed" | "declined" | "expired";
  signedAt?: string | null;
  signatureMethod?: string | null;
  evidenceRef?: string | null;
  declinedReason?: string | null;
}

export interface ProviderOrderStatus {
  providerOrderId: string;
  status: "sent" | "partially_signed" | "completed" | "declined" | "expired" | "cancelled";
  signers: ProviderSignerStatus[];
}

export interface SigningProvider {
  readonly name: string;
  /** Om leverandøren faktisk kan brukes (nøkler satt, avtale på plass). */
  isConfigured(): boolean;
  createOrder(req: CreateOrderRequest): Promise<CreatedOrder>;
  getOrderStatus(providerOrderId: string): Promise<ProviderOrderStatus>;
  cancelOrder(providerOrderId: string): Promise<void>;
  /**
   * Verifiserer at et callback faktisk kommer fra leverandøren. Alle aktuelle
   * leverandører signerer webhooks; hvilken mekanisme avgjøres av adapteren.
   */
  verifyCallback(headers: Record<string, string | string[] | undefined>, rawBody: string): boolean;
}

/**
 * Stub-adapter for utvikling og test.
 *
 * Signerer ingenting og har ingen juridisk verdi. Den finnes for at resten av
 * flyten skal kunne bygges og testes mens leverandørvalget pågår, og den
 * nekter å starte i produksjon nettopp fordi et signeringsbevis som ikke er
 * ekte er verre enn ingen signering.
 */
export class StubSigningProvider implements SigningProvider {
  readonly name = "stub";
  private orders = new Map<string, ProviderOrderStatus>();

  isConfigured(): boolean {
    return process.env.NODE_ENV !== "production";
  }

  async createOrder(req: CreateOrderRequest): Promise<CreatedOrder> {
    const providerOrderId = `stub_${req.reference}`;
    const signerLinks = req.signers.map((s, i) => ({
      fullName: s.fullName,
      url: `https://stub.invalid/sign/${providerOrderId}/${i}`,
      providerSignerId: `${providerOrderId}_${i}`,
    }));
    this.orders.set(providerOrderId, {
      providerOrderId,
      status: "sent",
      signers: signerLinks.map((l) => ({ providerSignerId: l.providerSignerId, status: "sent" })),
    });
    return { providerOrderId, signerLinks };
  }

  async getOrderStatus(providerOrderId: string): Promise<ProviderOrderStatus> {
    const order = this.orders.get(providerOrderId);
    if (!order) throw new Error(`Ukjent stub-oppdrag: ${providerOrderId}`);
    return order;
  }

  async cancelOrder(providerOrderId: string): Promise<void> {
    const order = this.orders.get(providerOrderId);
    if (order) order.status = "cancelled";
  }

  verifyCallback(): boolean {
    // Stubben har ingen delt hemmelighet å verifisere mot.
    return process.env.NODE_ENV !== "production";
  }

  /** Kun for test: marker en signatar som signert. */
  markSigned(providerOrderId: string, index: number): void {
    const order = this.orders.get(providerOrderId);
    if (!order) return;
    const signer = order.signers[index];
    if (!signer) return;
    signer.status = "signed";
    signer.signedAt = new Date().toISOString();
    signer.signatureMethod = "stub";
    signer.evidenceRef = `stub-evidence-${index}`;
    order.status = order.signers.every((s) => s.status === "signed") ? "completed" : "partially_signed";
  }
}

const PROVIDERS = new Map<string, SigningProvider>();

export function registerSigningProvider(provider: SigningProvider): void {
  PROVIDERS.set(provider.name, provider);
}

registerSigningProvider(new StubSigningProvider());

/**
 * Henter aktiv leverandør. Kaster med en handlingsrettet melding når ingen er
 * konfigurert — «BankID virker ikke» er ubrukelig for den som skal fikse det.
 */
export function getSigningProvider(name = process.env.RR_SIGNING_PROVIDER): SigningProvider {
  const key = (name || "stub").trim();
  const provider = PROVIDERS.get(key);
  if (!provider) {
    throw new Error(
      `Ukjent signeringsleverandør «${key}». Registrerte: ${[...PROVIDERS.keys()].join(", ")}. ` +
        `Leverandør er ikke valgt ennå — se THE-ROLE-ROOM-BANKID-BESLUTNINGSNOTAT.md § 8.`,
    );
  }
  if (!provider.isConfigured()) {
    throw new Error(
      `Signeringsleverandøren «${key}» mangler konfigurasjon. ` +
        (key === "stub"
          ? "Stub-adapteren kan ikke brukes i produksjon — den signerer ingenting."
          : "Sjekk API-nøkler og at avtalen er på plass."),
    );
  }
  return provider;
}

export function listSigningProviders(): Array<{ name: string; configured: boolean }> {
  return [...PROVIDERS.values()].map((p) => ({ name: p.name, configured: p.isConfigured() }));
}

/**
 * Utleder oppdragets status fra signatarenes.
 *
 * Én som avslår gjør hele oppdraget avslått — en kontrakt der én part har sagt
 * nei er ikke «delvis signert», den er død inntil noen gjør noe med den.
 */
export function deriveOrderStatus(
  signers: Array<{ status: string }>,
): "sent" | "partially_signed" | "completed" | "declined" | "expired" {
  if (signers.length === 0) return "sent";
  if (signers.some((s) => s.status === "declined")) return "declined";
  if (signers.every((s) => s.status === "signed")) return "completed";
  if (signers.some((s) => s.status === "expired")) return "expired";
  if (signers.some((s) => s.status === "signed")) return "partially_signed";
  return "sent";
}
