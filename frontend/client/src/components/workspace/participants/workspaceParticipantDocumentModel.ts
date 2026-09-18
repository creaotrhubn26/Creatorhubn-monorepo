import type { WorkspaceParticipantDocumentStatus } from "@shared/workspace-participant-documents";

const DOCUMENT_TOKEN_PATTERN = /^[A-Za-z0-9_-]{43}$/;

export interface WorkspaceParticipantDocumentLocation {
  pathname: string;
  search: string;
  hash: string;
}

/**
 * Consume the bearer credential from the URL fragment exactly once.
 *
 * The cleaned URL is installed before the credential is returned so callers
 * cannot accidentally leave it in browser history. Query parameters are
 * deliberately ignored: document credentials are fragment-only.
 */
export function consumeWorkspaceParticipantDocumentToken(
  location: WorkspaceParticipantDocumentLocation,
  replaceUrl: (cleanUrl: string) => void,
): string | null {
  const fragment = location.hash.startsWith("#")
    ? location.hash.slice(1)
    : location.hash;

  if (location.hash) {
    replaceUrl(`${location.pathname}${location.search}`);
  }

  if (!fragment) return null;
  const token = new URLSearchParams(fragment).get("token")?.trim() ?? "";
  return DOCUMENT_TOKEN_PATTERN.test(token) ? token : null;
}

export function parseWorkspaceParticipantDocumentList(value: string): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const item of value.split(/[\n,]/)) {
    const normalized = item.trim().replace(/\s+/g, " ");
    const key = normalized.toLocaleLowerCase("nb-NO");
    if (!normalized || seen.has(key)) continue;
    seen.add(key);
    result.push(normalized);
  }
  return result;
}

export function canReissueWorkspaceParticipantDocument(
  status: WorkspaceParticipantDocumentStatus,
): boolean {
  return !(["draft", "declined", "expired", "superseded"] as const).includes(
    status as "draft" | "declined" | "expired" | "superseded",
  );
}

export function isExactWorkspaceParticipantSignerName(
  value: string,
  expected: string,
): boolean {
  return value === expected;
}

export function optionalDocumentText(value: string): string | null {
  const normalized = value.trim();
  return normalized || null;
}
