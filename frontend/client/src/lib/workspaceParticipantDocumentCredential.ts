const PARTICIPANT_DOCUMENT_PATH =
  /^\/participant-document\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\/?$/i;
const PARTICIPANT_DOCUMENT_TOKEN = /^[A-Za-z0-9_-]{43}$/;

export const WORKSPACE_PARTICIPANT_DOCUMENT_CREDENTIAL_BRIDGE =
  "creatorhub.workspace-participant-document.credential.v1";

type LocationLike = Pick<Location, "pathname" | "search" | "hash">;

let primedCredential: { documentId: string; token: string } | null = null;

export function isWorkspaceParticipantDocumentPath(pathname: string): boolean {
  return PARTICIPANT_DOCUMENT_PATH.test(pathname);
}

/**
 * Takes the credential installed by the very first inline head script. The
 * symbol property is deleted before its value is inspected or copied to module
 * memory, leaving no durable credential on window.
 */
export function primeWorkspaceParticipantDocumentCredentialFromBridge(
  target: Window,
): boolean {
  const key = Symbol.for(WORKSPACE_PARTICIPANT_DOCUMENT_CREDENTIAL_BRIDGE);
  const bridgeTarget = target as Window & Record<symbol, unknown>;
  const bridge = bridgeTarget[key];
  try {
    delete bridgeTarget[key];
  } catch {
    try {
      Object.defineProperty(bridgeTarget, key, {
        value: undefined,
        configurable: true,
      });
      delete bridgeTarget[key];
    } catch {
      primedCredential = null;
      return false;
    }
  }

  if (typeof bridge !== "function") {
    primedCredential = null;
    return false;
  }
  let candidate: unknown;
  try {
    candidate = (bridge as () => unknown)();
  } catch {
    primedCredential = null;
    return false;
  }
  if (!candidate || typeof candidate !== "object") return false;
  const value = candidate as { documentId?: unknown; token?: unknown };
  const documentId =
    typeof value.documentId === "string"
      ? value.documentId.trim().toLowerCase()
      : "";
  const token = typeof value.token === "string" ? value.token.trim() : "";
  if (
    !PARTICIPANT_DOCUMENT_PATH.test(`/participant-document/${documentId}`) ||
    !PARTICIPANT_DOCUMENT_TOKEN.test(token)
  ) {
    primedCredential = null;
    return false;
  }
  primedCredential = { documentId, token };
  return true;
}

/**
 * Runs before the rest of the application bootstrap. The bearer credential is
 * moved from the URL fragment into module memory and the fragment is removed
 * before analytics, error reporting, auth migration, or React can inspect it.
 */
export function primeWorkspaceParticipantDocumentCredential(
  location: LocationLike,
  replaceUrl: (cleanUrl: string) => void,
): boolean {
  const match = PARTICIPANT_DOCUMENT_PATH.exec(location.pathname);
  if (!match) return false;

  const fragment = location.hash.startsWith("#")
    ? location.hash.slice(1)
    : location.hash;
  if (location.hash) {
    replaceUrl(location.pathname + location.search);
  }

  const token = fragment
    ? (new URLSearchParams(fragment).get("token")?.trim() ?? "")
    : "";
  primedCredential = PARTICIPANT_DOCUMENT_TOKEN.test(token)
    ? { documentId: match[1].toLowerCase(), token }
    : null;
  return primedCredential !== null;
}

export function takeWorkspaceParticipantDocumentCredential(
  documentId: string,
): string | null {
  if (
    !primedCredential ||
    primedCredential.documentId !== documentId.trim().toLowerCase()
  )
    return null;
  const token = primedCredential.token;
  primedCredential = null;
  return token;
}

export function clearWorkspaceParticipantDocumentCredential(): void {
  primedCredential = null;
}

if (typeof window !== "undefined") {
  const bridged = primeWorkspaceParticipantDocumentCredentialFromBridge(window);
  if (!bridged) {
    primeWorkspaceParticipantDocumentCredential(window.location, (cleanUrl) => {
      window.history.replaceState(
        window.history.state,
        window.document.title,
        cleanUrl,
      );
    });
  }
}
