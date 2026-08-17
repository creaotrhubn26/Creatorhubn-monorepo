import type { Pool } from "pg";
import type { MirrorRequest } from "./user-storage-providers";

/**
 * Stub for Drive-mirror worker.
 *
 * Denne modulen leveres/implementeres separat (annen agent). Inntil da
 * er begge eksportene fraværende slik at `user-storage-providers.ts`
 * faller tilbake til "ingen mirror" med én warning. Skriv om filen til
 * en ekte implementasjon når workeren er klar.
 */

export type DriveMirrorFn = (
  deps: { pool: Pool },
  params: MirrorRequest,
) => void | Promise<void>;

export const mirrorUploadToUserDrive: DriveMirrorFn | undefined = undefined;
export const enqueueMirrorToUserDrive: DriveMirrorFn | undefined = undefined;
