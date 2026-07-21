/**
 * Objektlagring for dokumentinnhold (bilag). Ligger bak en port slik at
 * lokal disk (utvikling/MVP) kan byttes med S3-kompatibelt lager i EU/EØS
 * uten endringer i domenelogikken.
 *
 * Oppbevaringsplikt: bilag skal aldri slettes fra lageret av applikasjonen —
 * porten har bevisst ingen delete-metode. Sletting er en driftsoperasjon
 * underlagt bokføringslovens frister (se docs/data-retention.md).
 */

export interface StoredObject {
  content: Buffer;
  mimeType: string;
}

export interface ObjectStorage {
  readonly name: string;
  put(key: string, content: Buffer, mimeType: string): Promise<void>;
  /** null hvis nøkkelen ikke finnes. */
  get(key: string): Promise<StoredObject | null>;
}
