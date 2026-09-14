/**
 * ws-upgrade-paths.ts — hvem eier hvilken `/ws/*`-sti på HTTP-serveren.
 *
 * Node emitter `'upgrade'` til ALLE lyttere på serveren; det finnes ingen
 * `stopPropagation`. `websocket-chat.ts` claimer hele prefikset `/ws/`, mens
 * tre andre sanntidsservere registrerer sin egen lytter for en eksakt sti
 * UNDER det prefikset. Uten en felles eierskapsliste fullfører chat-serveren
 * håndtrykket først, og den dedikerte serveren kaller så `handleUpgrade()` på
 * samme socket — `ws` kaster «handleUpgrade() was called more than once with
 * the same socket», og klienten ender enten på feil server eller får socketen
 * revet ned.
 *
 * Legger du til en ny dedikert `/ws/…`-server: sett stien her og bruk
 * konstanten i lytteren din. Da yielder chat-prefikset automatisk.
 */

export const DANCE_REALTIME_WS_PATH = "/ws/dance/realtime";
export const LEADGRID_CANVAS_WS_PATH = "/ws/leadgrid-canvas";
export const LEADGRID_REALTIME_WS_PATH = "/ws/leadgrid";

/** Stier under `/ws/` som eies av en egen upgrade-lytter, ikke av chat. */
export const DEDICATED_WS_UPGRADE_PATHS: ReadonlySet<string> = new Set([
  DANCE_REALTIME_WS_PATH,
  LEADGRID_CANVAS_WS_PATH,
  LEADGRID_REALTIME_WS_PATH,
]);

/**
 * Sann for stiene `websocket-chat.ts` skal håndtere: `/ws` og alt under
 * `/ws/` (`/ws/events`, `/ws/shotlist/:projectId`, …) UNNTATT stiene en
 * dedikert server eier.
 */
export function isChatUpgradePath(pathname: string): boolean {
  if (pathname !== "/ws" && !pathname.startsWith("/ws/")) return false;
  return !DEDICATED_WS_UPGRADE_PATHS.has(pathname);
}
