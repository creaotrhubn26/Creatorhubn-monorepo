/**
 * lead-ip-service.ts — Patentstyret OpenData som lead-berikelse
 * (Daniels datastruktur-punkt 4: varemerker/patenter/design som
 * innovasjons-indikator og kjøpssignal)
 *
 * Endepunkt verifisert live 2026-07-13:
 *   GET search.patentstyret.no/api/OpenData/Search/IprCasesByCompany
 *       ?companyNumber=<orgnr>  ELLER  ?name=<navn>
 *
 * Kjent kilde-egenskap: orgnr-koblingen avhenger av hvilken part saken
 * er registrert på — orgnr kan gi 0 der navnesøk treffer (verifisert:
 * Equinor). Strategien er orgnr først, navnesøk som fallback, og
 * `matchedBy` sier ÆRLIG hvilken som traff (navnetreff kan inneholde
 * navnebrødre — vises i UI).
 */

const IPR_API =
  "https://search.patentstyret.no/api/OpenData/Search/IprCasesByCompany";
const FETCH_TIMEOUT_MS = 12_000;

interface IprCaseRaw {
  registrationNumber?: string;
  applicationNumber?: string;
  markVerbalElementText?: string;
  currentStatusNo?: string;
  currentStatusDate?: string;
  caseUrl?: string;
}

interface IprResponseRaw {
  trademarkBagCount?: number;
  patentBagCount?: number;
  designBagCount?: number;
  trademarkBag?: IprCaseRaw[];
}

export interface IprTrademark {
  text: string;
  applicationNumber: string | null;
  status: string | null;
  statusDate: string | null; // YYYY-MM-DD
  caseUrl: string | null;
}

export interface IprProfile {
  matchedBy: "orgnr" | "name";
  trademarks: number;
  patents: number;
  designs: number;
  /** Nyeste varemerke-saker (etter statusdato), maks 5. */
  recentTrademarks: IprTrademark[];
}

/** Ren mapping (enhetstestet mot reell API-struktur). */
export function mapIprResponse(
  raw: IprResponseRaw,
  matchedBy: "orgnr" | "name",
): IprProfile | null {
  const trademarks = raw.trademarkBagCount ?? 0;
  const patents = raw.patentBagCount ?? 0;
  const designs = raw.designBagCount ?? 0;
  if (trademarks + patents + designs === 0) return null; // ingen IP = ingen profil, ikke nuller

  const recent = (raw.trademarkBag ?? [])
    .filter((c) => c.markVerbalElementText || c.applicationNumber)
    .map((c): IprTrademark => ({
      text: c.markVerbalElementText ?? `(søknad ${c.applicationNumber})`,
      applicationNumber: c.applicationNumber ?? null,
      status: c.currentStatusNo ?? null,
      statusDate: c.currentStatusDate?.slice(0, 10) ?? null,
      caseUrl: c.caseUrl ?? null,
    }))
    .sort((a, b) => (b.statusDate ?? "").localeCompare(a.statusDate ?? ""))
    .slice(0, 5);

  return { matchedBy, trademarks, patents, designs, recentTrademarks: recent };
}

async function fetchIpr(param: string): Promise<IprResponseRaw | null> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const r = await fetch(`${IPR_API}?${param}`, { signal: controller.signal });
    if (!r.ok) return null;
    return (await r.json()) as IprResponseRaw;
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * Orgnr først, navnesøk som fallback. null = ingen IP funnet (helt
 * vanlig — de fleste SMB har ingen registrerte rettigheter).
 */
export async function fetchIprProfile(
  orgNr: string | null,
  companyName: string,
): Promise<IprProfile | null> {
  if (orgNr) {
    const byOrg = await fetchIpr(`companyNumber=${encodeURIComponent(orgNr)}`);
    if (byOrg) {
      const mapped = mapIprResponse(byOrg, "orgnr");
      if (mapped) return mapped;
    }
  }
  if (companyName.trim().length >= 4) {
    const byName = await fetchIpr(`name=${encodeURIComponent(companyName.trim())}`);
    if (byName) return mapIprResponse(byName, "name");
  }
  return null;
}
