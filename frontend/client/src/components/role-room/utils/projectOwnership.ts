/**
 * Eierskaps-helpers for prosjekter.
 *
 * Brukes for å avgjøre om innlogget bruker bør varsles når et åpnet prosjekt
 * eies av en annen bruker — typisk fordi paneler da virker tomme uten
 * forklaring (backend filtrerer sub-data per user).
 */

export interface ProjectOwnerShape {
  ownerId?: unknown;
  owner_id?: unknown;
  ownerEmail?: unknown;
  owner_email?: unknown;
}

export interface OwnershipCheckUser {
  id?: string | number | null;
  email?: string | null;
}

export interface OwnershipWarning {
  warn: true;
  ownerLabel: string;
  currentLabel: string;
}

export type OwnershipCheckResult = { warn: false } | OwnershipWarning;

function readString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

export function evaluateProjectOwnership(
  project: ProjectOwnerShape | null | undefined,
  user: OwnershipCheckUser | null | undefined,
): OwnershipCheckResult {
  if (!project) return { warn: false };

  const adminId = String(user?.id ?? '').trim();
  const adminEmail = String(user?.email ?? '').trim().toLowerCase();
  if (!adminId && !adminEmail) return { warn: false };

  const ownerId = readString(project.ownerId ?? project.owner_id);
  const ownerEmail = readString(project.ownerEmail ?? project.owner_email).toLowerCase();
  if (!ownerId && !ownerEmail) return { warn: false };

  const matchById = ownerId !== '' && adminId !== '' && ownerId === adminId;
  const matchByEmail = ownerEmail !== '' && adminEmail !== '' && ownerEmail === adminEmail;
  if (matchById || matchByEmail) return { warn: false };

  const ownerLabel = ownerEmail || ownerId;
  const currentLabel = readString(user?.email).toLowerCase() || adminId || 'ukjent bruker';
  return { warn: true, ownerLabel, currentLabel };
}
