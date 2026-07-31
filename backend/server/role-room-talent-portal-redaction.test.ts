/**
 * Vakttest for talentportalens lesesti.
 *
 * To ting skal holde, og begge er lette å bryte uten å merke det:
 *
 *   1. Kandidatraden som sendes til talentet skal ikke inneholde
 *      castingteamets interne vurdering (`notes`, `rating`).
 *   2. Aktivitetsloggen skal bare hente innslag merket `shared`.
 *
 * Testen leser kildekoden i stedet for å kalle rutene. Det er svakere enn
 * en oppførselstest, og verdt å si høyt: serializeren og spørringen ligger
 * inne i en closure i role-room-routes.ts og bruker to closure-scopede
 * hjelpere (`toStringArray`, `normalizeRoleRoomTalentMediaList`). Å teste
 * dem direkte krever at de trekkes ut — en refaktorering av en fil som
 * allerede bærer 59 kjente typefeil. Vakten er mellomløsningen: den fanger
 * den feilen som faktisk skjedde her (et felt lagt tilbake fordi raden ble
 * sendt hel), uten å røre resten.
 *
 * Blir serializeren trukket ut senere: slett denne og skriv ekte
 * enhetstester i stedet.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

// Ikke process.cwd() — suiten kjøres både fra repo-rot og fra backend/.
const SOURCE = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), "role-room-routes.ts"),
  "utf8",
);

/** Kroppen til buildRoleRoomTalentPortalCandidate, uten omkringliggende fil. */
function candidateSerializerBody(): string {
  const start = SOURCE.indexOf("function buildRoleRoomTalentPortalCandidate");
  expect(
    start,
    "buildRoleRoomTalentPortalCandidate finnes ikke lenger — er den " +
      "omdøpt eller trukket ut? Oppdater eller slett denne vakten.",
  ).toBeGreaterThan(-1);

  // Neste funksjonsdeklarasjon på samme nivå avgrenser kroppen.
  const end = SOURCE.indexOf("function buildRoleRoomTalentPortalRole", start);
  expect(end).toBeGreaterThan(start);
  return SOURCE.slice(start, end);
}

describe("talentportalen: kandidatraden", () => {
  it("sender ikke castingteamets notater til talentet", () => {
    // row.notes er produsentens notat OM talentet. Talentets egne notater
    // ligger på schedule og video, ikke på kandidatraden.
    expect(candidateSerializerBody()).not.toMatch(/\brow\.notes\b/);
  });

  it("sender ikke castingteamets vurdering til talentet", () => {
    expect(candidateSerializerBody()).not.toMatch(/\brow\.rating\b/);
  });

  it("sender fortsatt status — talentet skal se hvor søknaden står", () => {
    // Motvekt: uten denne kunne vakten «bestås» ved å redigere bort alt.
    expect(candidateSerializerBody()).toMatch(/\brow\.status\b/);
  });

  it("sender fortsatt talentets egne profilfelt", () => {
    const body = candidateSerializerBody();
    expect(body).toMatch(/talentProfile\.bio/);
    expect(body).toMatch(/row\.reminder_prefs/);
  });
});

describe("talentportalen: aktivitetsloggen", () => {
  it("henter bare delte innslag", () => {
    // Kolonnen finnes for å skille intern prat fra delt. Uten filteret
    // her er den dekorasjon.
    const query = SOURCE.slice(
      SOURCE.indexOf("FROM role_room_talent_activity"),
      SOURCE.indexOf("LIMIT 200"),
    );
    expect(query).toMatch(/visibility\s*=\s*'shared'/);
  });

  it("har bare én lesespørring mot aktivitetsloggen", () => {
    // Legges det til en spørring nummer to uten filteret, er fiksen omgått.
    // Treffene er: CREATE TABLE, to CREATE INDEX, én INSERT, én SELECT.
    const hits = SOURCE.match(/role_room_talent_activity/g) ?? [];
    expect(
      hits.length,
      "Nytt treff på role_room_talent_activity — filtrerer den nye " +
        "spørringen på visibility?",
    ).toBe(5);
  });
});
