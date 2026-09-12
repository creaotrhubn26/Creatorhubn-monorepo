/**
 * Brønnøysundregistrene-oppslag for Role Room — klient-side søk mot det åpne
 * Enhetsregisteret (data.brreg.no, ingen backend/nøkkel). Samme mønster som
 * hovedflytens InviteRequestForm, men innkapslet lokalt for Role Room så
 * onboarding kan forhåndsutfylle firma-info (navn + org.nr + forretningsadresse).
 */

export interface BrregCompany {
  organisasjonsnummer: string;
  navn: string;
  forretningsadresse?: BrregAddress;
  beliggenhetsadresse?: BrregAddress;
  adresse?: BrregAddress;
}

interface BrregAddress {
  adresse?: string | string[];
  adresselinje1?: string;
  postnummer?: string;
  poststed?: string;
}

export interface BrregSelection {
  companyName: string;
  organizationNumber: string;
  businessAddress: string;
}

/** Norsk org.nr er nøyaktig 9 siffer (kan skrives med mellomrom). */
export function isValidNorwegianOrganizationNumber(value: string): boolean {
  return /^\d{9}$/.test(value.replace(/\s/g, ''));
}

/**
 * Søk i Enhetsregisteret. Rene tall (<=9) tolkes som org.nr, ellers navnesøk.
 * Returnerer opptil 10 treff; ved feil returneres tom liste (aldri kast).
 */
export async function searchBrregCompanies(searchTerm: string): Promise<BrregCompany[]> {
  const term = searchTerm.trim();
  if (term.length < 2) return [];

  const isOrgNumber = /^\d+$/.test(term.replace(/\s/g, ''));
  const url = isOrgNumber && term.replace(/\s/g, '').length <= 9
    ? `https://data.brreg.no/enhetsregisteret/api/enheter?organisasjonsnummer=${term.replace(/\s/g, '')}*&size=10`
    : `https://data.brreg.no/enhetsregisteret/api/enheter?navn=${encodeURIComponent(term)}*&size=10`;

  try {
    const response = await fetch(url);
    if (!response.ok) return [];
    const data = await response.json();
    return (data?._embedded?.enheter as BrregCompany[]) || [];
  } catch (err) {
    console.warn('[role-room brreg] search failed:', err);
    return [];
  }
}

/** Formaterer et Brreg-treff til feltene onboarding lagrer. */
export function toBrregSelection(company: BrregCompany): BrregSelection {
  const address = company.forretningsadresse || company.beliggenhetsadresse || company.adresse;
  let businessAddress = '';
  if (address) {
    const line = Array.isArray(address.adresse)
      ? address.adresse.filter(Boolean).join(', ')
      : address.adresse || address.adresselinje1 || '';
    const postal = [address.postnummer, address.poststed].filter(Boolean).join(' ');
    businessAddress = [line, postal].filter(Boolean).join(', ').trim();
  }
  return {
    companyName: company.navn,
    organizationNumber: company.organisasjonsnummer,
    businessAddress,
  };
}
