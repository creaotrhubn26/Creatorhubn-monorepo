export type ManuscriptScopedEntity = "acts" | "dialogue" | "scenes";

export function buildManuscriptScopedEntityUrl(
  entity: ManuscriptScopedEntity,
  entityId: string,
  manuscriptId: string,
): string {
  const normalizedEntityId = String(entityId || "").trim();
  const normalizedManuscriptId = String(manuscriptId || "").trim();
  if (!normalizedEntityId) {
    throw new Error(`${entity} entityId is required`);
  }
  if (!normalizedManuscriptId) {
    throw new Error("manuscriptId is required");
  }

  return `/api/casting/${entity}/${encodeURIComponent(normalizedEntityId)}?manuscriptId=${encodeURIComponent(normalizedManuscriptId)}`;
}
