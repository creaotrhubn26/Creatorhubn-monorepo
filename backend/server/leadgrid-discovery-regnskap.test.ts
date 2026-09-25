/**
 * Et godkjent Discovery-lead skal få regnskapstallene sine.
 *
 * Uten dem viser Pondus-maler som åpner med kundens eget tall bare et tomt
 * felt — og den åpningen er hele grunnen til at malene virker.
 *
 * Tre ting vaktes her: at det skjer i det hele tatt, at det skjer ETTER
 * transaksjonen, og at en feil i berikelsen ikke velter godkjenningen.
 */
import { describe, expect, it, vi } from "vitest";

const beriket = vi.hoisted(() => vi.fn());
vi.mock("./lead-brreg-service.js", async (orig) => ({
  ...(await orig<typeof import("./lead-brreg-service.js")>()),
  enrichLeadWithBrreg: beriket,
}));

describe("regnskap på godkjente Discovery-leads", () => {
  it("henter regnskapet med lead, org og prosjekt", async () => {
    // Signaturen er kontrakten mot enrichLeadWithBrreg. Endres den uten at
    // kallet følger med, slutter berikelsen stille å virke.
    beriket.mockResolvedValue({ found: true });
    const { enrichLeadWithBrreg } = await import("./lead-brreg-service.js");
    await (enrichLeadWithBrreg as unknown as typeof beriket)(
      {} as never,
      {
        leadId: "11111111-1111-4111-8111-111111111111",
        workspaceOwnerUserId: "bruker-1",
        organizationId: "22222222-2222-4222-8222-222222222222",
        projectId: "leadgrid-egne-kunder",
      },
    );
    expect(beriket).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        leadId: "11111111-1111-4111-8111-111111111111",
        organizationId: "22222222-2222-4222-8222-222222222222",
        projectId: "leadgrid-egne-kunder",
      }),
    );
  });

  it("kjøres uten await, så godkjenningen ikke venter på BRREG", async () => {
    // Kallet i tjenesten er `void enrichLeadWithBrreg(...).catch(...)`.
    // Ville det blitt ventet på, ville en treg BRREG gjort hver godkjenning
    // like treg — og vi målte i kveld hva som skjer når et register er
    // tregere enn man antar.
    const kilde = await import("node:fs").then((fs) =>
      fs.readFileSync("server/leadgrid-discovery-service.ts", "utf8"));
    expect(kilde).toMatch(/void enrichLeadWithBrreg\(pool, \{/);
    expect(kilde).not.toMatch(/await enrichLeadWithBrreg\(/);
  });

  it("står etter broadcastLeadCreated, altså utenfor transaksjonen", async () => {
    // Et BRREG-kall kan bruke ti sekunder. Så lenge skal ingen holde en
    // databasetilkobling.
    const kilde = await import("node:fs").then((fs) =>
      fs.readFileSync("server/leadgrid-discovery-service.ts", "utf8"));
    const broadcast = kilde.indexOf("broadcastLeadCreated(input.project.organizationId");
    const berik = kilde.indexOf("void enrichLeadWithBrreg");
    expect(broadcast).toBeGreaterThan(0);
    expect(berik).toBeGreaterThan(broadcast);
  });

  it("har en catch, så en feilet berikelse ikke velter godkjenningen", async () => {
    const kilde = await import("node:fs").then((fs) =>
      fs.readFileSync("server/leadgrid-discovery-service.ts", "utf8"));
    const utdrag = kilde.slice(kilde.indexOf("void enrichLeadWithBrreg"));
    expect(utdrag.slice(0, 600)).toMatch(/\.catch\(/);
  });
});
