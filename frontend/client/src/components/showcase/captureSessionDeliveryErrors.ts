/**
 * Pure mapping from the backend's error shapes to photographer-
 * readable Norwegian messages. Extracted from
 * ``CaptureSessionsPanel`` so the phrasing is pinned by tests and
 * the UI layer stays free of string-matching logic.
 *
 * The backend's ``POST /api/capture/sessions/:id/deliver-to-showcase``
 * returns plain ``{ error: "<code>", detail?: string }`` bodies;
 * ``apiRequest`` surfaces those codes inside the thrown Error's
 * message. We match on the code here rather than the HTTP status
 * because the server uses the same codes across multiple statuses
 * (``no_picks`` is a 400, ``not_found`` is a 404, etc.).
 */

export function friendlyDeliveryErrorMessage(
  error: Error | null | undefined,
): string | null {
  if (!error) return null;
  const raw = error.message ?? "";
  if (raw.includes("no_picks")) {
    return "Ingen bilder i økten matcher filteret. Merk noen bilder som hero eller gi dem 4★+ på iPaden først.";
  }
  if (raw.includes("not_found")) {
    return "Økten finnes ikke lenger på serveren.";
  }
  if (raw.includes("unauthorized") || raw.includes("401")) {
    return "Du er ikke logget inn. Prøv å laste siden på nytt.";
  }
  if (raw.includes("forbidden") || raw.includes("403")) {
    return "Du har ikke tilgang til å levere denne økten.";
  }
  if (raw.includes("500") || raw.includes("502") || raw.includes("503")) {
    return "Serveren svarte ikke. Prøv igjen om et øyeblikk.";
  }
  return "Kunne ikke levere økten. Prøv igjen om et øyeblikk.";
}
