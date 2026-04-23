/**
 * Pure helper shared between ``UniversalDashboard`` (which stashes
 * the deep-link intent into sessionStorage) and ``AdministrationHub``
 * (which consumes it on mount). Extracted so the mapping is unit-
 * testable without mounting React trees or monkey-patching the
 * browser storage APIs.
 *
 * Inputs: the raw ``?subTab=`` query value the iPad CreatorHub One
 * shell appends to its tab-deep-links. Norwegian + English aliases
 * both route so photographers copy-pasting URLs from chat don't hit
 * 404-style silent no-ops.
 *
 * Output: a typed ``AdministrationDeepLinkTarget``. ``kind: "tab"``
 * tells the hub which numeric sub-tab to open. ``kind: "quote"`` is
 * special-cased because "generate a quote" isn't actually a tab —
 * it's a modal that opens over the Prisadministrasjon tab so the
 * photographer still sees the package context.
 *
 * Returning ``null`` is deliberate for unknown subTabs: the caller
 * keeps whatever tab was already active rather than snapping to 0
 * and surprising the user.
 */

export type AdministrationDeepLinkTarget =
  | { kind: "tab"; tabIndex: number }
  | { kind: "quote"; tabIndex: 0 };

const SUBTAB_INDEX: Record<string, number> = {
  pricing: 0,
  prisadministrasjon: 0,
  contracts: 1,
  kontrakter: 1,
  communication: 2,
  kommunikasjon: 2,
  messages: 2,
  evendi: 3,
};

export function resolveAdministrationDeepLink(
  subTab: string | null | undefined,
): AdministrationDeepLinkTarget | null {
  if (!subTab) return null;
  const key = subTab.toLowerCase().trim();
  if (key.length === 0) return null;
  if (key === "quotes" || key === "tilbud") {
    return { kind: "quote", tabIndex: 0 };
  }
  const idx = SUBTAB_INDEX[key];
  if (typeof idx === "number") {
    return { kind: "tab", tabIndex: idx };
  }
  return null;
}

/// Read + clear the dashboard → hub handoff from sessionStorage. The
/// dashboard writes ``{ tab, subTab }`` when it consumes a deep-link
/// URL param. The hub reads it on mount (URL params are stripped by
/// then, so sessionStorage is the only source). Returns ``null`` if
/// the key is missing, malformed, or sessionStorage is disabled.
export function consumePendingAdministrationDeepLink(
  storage: Pick<Storage, "getItem" | "removeItem"> | null = (() => {
    try {
      return typeof window !== "undefined" ? window.sessionStorage : null;
    } catch {
      return null;
    }
  })(),
): AdministrationDeepLinkTarget | null {
  if (!storage) return null;
  try {
    const raw = storage.getItem("creatorhub:pending-subtab");
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { tab?: string; subTab?: string };
    if (!parsed) return null;
    if (parsed.tab && parsed.tab.toLowerCase() !== "administration") {
      // Intent was for a different main tab — leave it for the hub
      // that actually cares, don't consume-and-discard.
      return null;
    }
    const target = resolveAdministrationDeepLink(parsed.subTab);
    storage.removeItem("creatorhub:pending-subtab");
    return target;
  } catch {
    return null;
  }
}
