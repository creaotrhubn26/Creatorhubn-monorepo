/**
 * Oppslag mot Enhetsregisteret (Brønnøysundregistrene) — åpne data, ingen nøkkel.
 * Brukes til å kontrollere selgers MVA-registrering før det skrives «MVA» bak
 * organisasjonsnummeret på salgsdokumenter (bokføringsforskriften § 5-1-1 jf.
 * mval. § 15-11). Registeret er fasit; lokal MVA-status er brukerens påstand.
 *
 * API: GET https://data.brreg.no/enhetsregisteret/api/enheter/{orgnr}
 * Feltet `registrertIMvaregisteret` er autoritativt svar.
 */

export interface VatRegisterResult {
  /** Fantes organisasjonsnummeret i Enhetsregisteret? */
  found: boolean;
  /** Navn slik det står i registeret (kun når found). */
  name?: string;
  /** Registrert i MVA-registeret (kun når found). */
  registeredInVatRegister?: boolean;
  /** Slettet fra Enhetsregisteret (kun når found og satt). */
  deleted?: boolean;
}

export interface VatRegisterLookup {
  /** Slår opp et 9-sifret organisasjonsnummer. Kaster ved nettverks-/tjenestefeil. */
  lookup(orgNumber: string): Promise<VatRegisterResult>;
}

type FetchLike = (url: string, init?: { signal?: AbortSignal; headers?: Record<string, string> }) => Promise<{
  status: number;
  ok: boolean;
  json(): Promise<unknown>;
}>;

const BRREG_BASE_URL = 'https://data.brreg.no/enhetsregisteret/api/enheter';

export class BrregVatRegisterClient implements VatRegisterLookup {
  constructor(
    private readonly fetchImpl: FetchLike = fetch as unknown as FetchLike,
    private readonly timeoutMs = 8000,
  ) {}

  async lookup(orgNumber: string): Promise<VatRegisterResult> {
    if (!/^\d{9}$/.test(orgNumber)) {
      throw new Error('Organisasjonsnummer må være 9 sifre.');
    }
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      const res = await this.fetchImpl(`${BRREG_BASE_URL}/${orgNumber}`, {
        signal: controller.signal,
        headers: { accept: 'application/json' },
      });
      if (res.status === 404 || res.status === 410) return { found: false };
      if (!res.ok) {
        throw new Error(`Enhetsregisteret svarte med status ${res.status}.`);
      }
      const body = (await res.json()) as {
        navn?: string;
        registrertIMvaregisteret?: boolean;
        slettedato?: string;
      };
      return {
        found: true,
        name: body.navn ?? '',
        registeredInVatRegister: body.registrertIMvaregisteret === true,
        deleted: Boolean(body.slettedato),
      };
    } finally {
      clearTimeout(timer);
    }
  }
}

/** Test-/sandboxstub: deterministiske svar uten nettverk. */
export class StaticVatRegisterStub implements VatRegisterLookup {
  constructor(private readonly entries: Record<string, VatRegisterResult>) {}

  async lookup(orgNumber: string): Promise<VatRegisterResult> {
    return this.entries[orgNumber] ?? { found: false };
  }
}
