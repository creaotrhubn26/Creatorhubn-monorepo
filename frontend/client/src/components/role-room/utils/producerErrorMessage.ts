/**
 * Menneskelige, handlingsorienterte feilmeldinger for innholdsprodusent-flatene.
 *
 * Bakgrunn: producer-panelene viste enten ingenting (stille catch) eller rå
 * tekniske feil ("401: auth_required", "Failed to fetch") til brukeren. Stig
 * (innholdsprodusenten) skal alltid forstå HVA som skjedde og HVA han gjør nå.
 *
 * `describeProducerError(error, action)` mapper en feil fra apiRequest/
 * producerWorkflowRequest/fetch til en norsk setning som skiller offline,
 * utløpt økt, rate-limit og server-feil — med et konkret neste steg.
 */

function errorStatus(error: unknown): number | undefined {
  const status = (error as { status?: number } | null | undefined)?.status;
  return typeof status === 'number' ? status : undefined;
}

/**
 * Er feilen forbigående/infrastruktur (offline, timeout, server) — altså noe
 * som mest sannsynlig løser seg ved å prøve igjen senere — i motsetning til en
 * permanent validerings-/tilgangsfeil brukeren selv må rette?
 */
export function isTransientProducerError(error: unknown): boolean {
  const status = errorStatus(error);
  if (status === undefined) return true; // nettverksfeil (ingen HTTP-status)
  return status === 0 || status === 408 || status === 429 || status >= 500;
}

/**
 * @param action Kort substantiv-frase for handlingen, f.eks. "lagre budsjettlinjen".
 *   Brukes i meldingen: «Kunne ikke {action}.»
 */
export function describeProducerError(error: unknown, action: string): string {
  const status = errorStatus(error);
  const lower = action.charAt(0).toLowerCase() + action.slice(1);

  // Nettverksfeil (fetch kastet) → ingen HTTP-status.
  if (status === undefined || status === 0) {
    return `Du ser ut til å være offline. Klarte ikke å ${lower} akkurat nå — endringen er bevart lokalt og prøves igjen når du er tilkoblet.`;
  }
  if (status === 401 || status === 403) {
    return `Økten din kan ha utløpt. Logg inn på nytt, så kan du ${lower} igjen.`;
  }
  if (status === 408) {
    return `Det tok for lang tid. Sjekk nettforbindelsen og prøv å ${lower} på nytt.`;
  }
  if (status === 429) {
    return `For mange forespørsler akkurat nå. Vent et øyeblikk og prøv igjen.`;
  }
  if (status >= 500) {
    return `Tjenesten er midlertidig utilgjengelig. Prøv å ${lower} igjen om litt.`;
  }
  // Permanent klientfeil (400/404/409/422 …) — vis backend-detalj hvis nyttig.
  const detail = error instanceof Error && error.message && !/^\d{3}:/.test(error.message)
    ? ` (${error.message})`
    : '';
  return `Kunne ikke ${lower}.${detail} Sjekk feltene og prøv igjen.`;
}
