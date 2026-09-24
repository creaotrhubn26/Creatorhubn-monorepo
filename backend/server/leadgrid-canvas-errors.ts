/**
 * Feil fra Nexus-laget, med status og kode.
 *
 * Hentet ut av leadgrid-canvas-service.ts i PR #2097. Den filen er en større
 * omskriving som ikke har landet; klassen her er de ti linjene pagineringen
 * og rate-limitingen faktisk trenger. Å dra inn hele tjenestefilen for en
 * feiltype ville vært å merge omskrivingen i smug.
 */
export class CanvasServiceError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    readonly details?: Record<string, unknown>,
  ) {
    super(code);
    this.name = "CanvasServiceError";
  }
}
