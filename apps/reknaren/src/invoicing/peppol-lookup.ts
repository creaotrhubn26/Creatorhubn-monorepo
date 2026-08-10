/**
 * PEPPOL/ELMA-oppslag: kan en mottaker ta imot EHF-faktura elektronisk?
 *
 * Bruker OpenPeppols offentlige katalog (directory.peppol.eu) — ingen aksesspunkt-
 * avtale eller nøkkel kreves for å SLÅ OPP. En norsk virksomhet identifiseres med
 * PEPPOL-deltaker-ID `0192:<orgnr>` (0192 = norsk organisasjonsnummer). Katalogen
 * svarer med deltakerens publiserte dokumenttyper; finner vi PEPPOL BIS Billing
 * 3.0-fakturaen der, vet vi at «Send via EHF» faktisk vil nå frem. (Aksesspunktet
 * gjør et autoritativt SMP-oppslag ved selve sendingen; dette er forhåndssjekken
 * som gir god UX — bygger på publiserte «business cards» i katalogen.)
 *
 * 🔒 Rent oppslag. Sender ingenting; bokfører ingenting.
 */

const DIRECTORY_URL = 'https://directory.peppol.eu/search/1.0/json';
/** Dokumenttype-fragmenter som identifiserer EHF/PEPPOL BIS Billing 3.0-faktura. */
const INVOICE_DOC = 'Invoice-2';
const BILLING_30 = 'peppol.eu:2017:poacc:billing:3.0';

export interface PeppolCapability {
  /** PEPPOL-deltaker-ID, f.eks. «0192:923609016». */
  participantId: string;
  /** Er mottakeren registrert/publisert i PEPPOL-katalogen? */
  registered: boolean;
  /** Kan mottakeren ta imot EHF-faktura (BIS Billing 3.0)? */
  supportsEhfInvoice: boolean;
  /** Navn fra katalogen (til visning), hvis funnet. */
  name: string | null;
  /** Kort forklaring til visning. */
  note: string;
}

type FetchLike = (
  url: string,
  init: { method: string; headers: Record<string, string>; signal?: AbortSignal },
) => Promise<{ status: number; ok: boolean; json(): Promise<unknown>; text(): Promise<string> }>;

interface DirectoryMatch {
  entities?: { name?: unknown }[];
  docTypes?: { value?: string }[];
}

/** Avgjør EHF-faktura-støtte fra deltakerens publiserte dokumenttyper. Eksportert for test. */
export function classifyDocTypes(values: string[]): boolean {
  return values.some((v) => v.includes(INVOICE_DOC) && v.includes(BILLING_30));
}

/** Trekker ut navnet fra en katalog-treff (business card kan ha flere entiteter). */
function nameOf(match: DirectoryMatch | undefined): string | null {
  const raw = match?.entities?.[0]?.name;
  if (typeof raw === 'string') return raw;
  // Enkelte «business cards» har navn som liste av {name, language}.
  if (Array.isArray(raw)) {
    const first = raw.find((n) => n && typeof (n as { name?: unknown }).name === 'string') as { name?: string } | undefined;
    return first?.name ?? null;
  }
  return null;
}

/**
 * Slår opp om `orgNumber` (9 sifre) kan motta EHF-faktura via PEPPOL.
 * Ren lesing mot offentlig katalog; `fetchImpl` er injiserbar for test.
 */
export async function lookupPeppolParticipant(
  orgNumber: string,
  opts: { fetchImpl?: FetchLike; timeoutMs?: number } = {},
): Promise<PeppolCapability> {
  const participantId = `0192:${orgNumber}`;
  if (!/^\d{9}$/.test(orgNumber)) {
    return { participantId, registered: false, supportsEhfInvoice: false, name: null, note: 'Mangler gyldig organisasjonsnummer (9 sifre).' };
  }
  const fetchImpl = opts.fetchImpl ?? (fetch as unknown as FetchLike);
  const url = `${DIRECTORY_URL}?participant=${encodeURIComponent(`iso6523-actorid-upis::0192:${orgNumber}`)}`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), opts.timeoutMs ?? 8000);
  try {
    const res = await fetchImpl(url, { method: 'GET', headers: { accept: 'application/json' }, signal: controller.signal });
    if (!res.ok) {
      return { participantId, registered: false, supportsEhfInvoice: false, name: null, note: `PEPPOL-oppslaget svarte ${res.status}. Prøv igjen senere.` };
    }
    const body = (await res.json()) as { matches?: DirectoryMatch[] };
    const matches = Array.isArray(body.matches) ? body.matches : [];
    if (matches.length === 0) {
      return { participantId, registered: false, supportsEhfInvoice: false, name: null, note: 'Ikke funnet i PEPPOL-katalogen — kan trolig ikke motta EHF. Send faktura på e-post/PDF, eller bekreft med mottaker.' };
    }
    const docTypes = matches.flatMap((m) => (m.docTypes ?? []).map((d) => d.value ?? ''));
    const supportsEhfInvoice = classifyDocTypes(docTypes);
    return {
      participantId,
      registered: true,
      supportsEhfInvoice,
      name: nameOf(matches[0]),
      note: supportsEhfInvoice
        ? 'Registrert i PEPPOL og kan motta EHF-faktura (BIS Billing 3.0).'
        : 'Registrert i PEPPOL, men fant ingen EHF-faktura-tjeneste. Bekreft med mottaker eller send på e-post.',
    };
  } catch {
    return { participantId, registered: false, supportsEhfInvoice: false, name: null, note: 'Fikk ikke kontakt med PEPPOL-oppslaget (nettverk/tidsavbrudd).' };
  } finally {
    clearTimeout(timer);
  }
}
