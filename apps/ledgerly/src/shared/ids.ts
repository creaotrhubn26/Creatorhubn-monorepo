import { randomUUID } from 'node:crypto';

/** Alle entiteter med økonomisk betydning har unik, ugjettbar identifikator. */
export function newId(): string {
  return randomUUID();
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isValidId(id: string): boolean {
  return UUID_RE.test(id);
}
