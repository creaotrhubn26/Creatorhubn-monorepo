/**
 * Enhetsregisteret (Brønnøysund) — full virksomhetsoppslag til kunde-/leverandør-
 * risiko. Åpne, gratis data (ingen nøkkel). Roller, signaturrett og reelle
 * rettighetshavere ligger bak egne API-er/tilgang og hentes ikke her (v1).
 *
 * API: GET https://data.brreg.no/enhetsregisteret/api/enheter/{orgnr}
 * Port + injiserbar fetch/stub, så motoren kan testes uten nettverk.
 */
export interface CompanyProfile {
  found: boolean;
  orgNumber: string;
  name?: string;
  orgForm?: string;
  registeredInVatRegister?: boolean;
  bankrupt?: boolean; // konkurs
  underLiquidation?: boolean; // underAvvikling
  forcedLiquidation?: boolean; // tvangsavvikling/-oppløsning
  deletedDate?: string | null; // slettedato
  foundedDate?: string | null; // stiftelsesdato
  address?: { street?: string; postalCode?: string; city?: string };
  naceCode?: string | null; // NACE-bransjekode (næringskode1)
}

export interface CompanyRegistry {
  lookup(orgNumber: string): Promise<CompanyProfile>;
}

type FetchLike = (url: string, init?: { signal?: AbortSignal; headers?: Record<string, string> }) => Promise<{
  status: number;
  ok: boolean;
  json(): Promise<unknown>;
}>;

const BRREG_BASE_URL = 'https://data.brreg.no/enhetsregisteret/api/enheter';

export class BrregCompanyRegistry implements CompanyRegistry {
  readonly hasApiKey = false;
  constructor(
    private readonly fetchImpl: FetchLike = fetch as unknown as FetchLike,
    private readonly timeoutMs = 8000,
  ) {}

  async lookup(orgNumber: string): Promise<CompanyProfile> {
    if (!/^\d{9}$/.test(orgNumber)) throw new Error('Organisasjonsnummer må være 9 sifre.');
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      const res = await this.fetchImpl(`${BRREG_BASE_URL}/${orgNumber}`, {
        signal: controller.signal,
        headers: { accept: 'application/json' },
      });
      if (res.status === 404 || res.status === 410) return { found: false, orgNumber };
      if (!res.ok) throw new Error(`Enhetsregisteret svarte med status ${res.status}.`);
      const b = (await res.json()) as {
        navn?: string;
        organisasjonsform?: { beskrivelse?: string };
        registrertIMvaregisteret?: boolean;
        konkurs?: boolean;
        underAvvikling?: boolean;
        underTvangsavviklingEllerTvangsopplosning?: boolean;
        slettedato?: string;
        stiftelsesdato?: string;
        forretningsadresse?: { adresse?: string[]; postnummer?: string; poststed?: string };
        naeringskode1?: { kode?: string };
      };
      const addr = b.forretningsadresse;
      return {
        found: true,
        orgNumber,
        name: b.navn ?? '',
        ...(b.organisasjonsform?.beskrivelse ? { orgForm: b.organisasjonsform.beskrivelse } : {}),
        registeredInVatRegister: b.registrertIMvaregisteret === true,
        bankrupt: b.konkurs === true,
        underLiquidation: b.underAvvikling === true,
        forcedLiquidation: b.underTvangsavviklingEllerTvangsopplosning === true,
        deletedDate: b.slettedato ?? null,
        foundedDate: b.stiftelsesdato ?? null,
        naceCode: b.naeringskode1?.kode ?? null,
        ...(addr
          ? {
              address: {
                ...(addr.adresse?.length ? { street: addr.adresse.join(' ') } : {}),
                ...(addr.postnummer ? { postalCode: addr.postnummer } : {}),
                ...(addr.poststed ? { city: addr.poststed } : {}),
              },
            }
          : {}),
      };
    } finally {
      clearTimeout(timer);
    }
  }
}

/** Test-/sandboxstub. */
export class StaticCompanyRegistryStub implements CompanyRegistry {
  readonly hasApiKey = false;
  constructor(private readonly entries: Record<string, CompanyProfile>) {}
  async lookup(orgNumber: string): Promise<CompanyProfile> {
    return this.entries[orgNumber] ?? { found: false, orgNumber };
  }
}
