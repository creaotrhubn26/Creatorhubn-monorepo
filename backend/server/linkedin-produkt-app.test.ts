/**
 * Hvilken LinkedIn-app brukes til innlogging?
 *
 * Samtykkeskjermen viser APPENS navn og logo. Logger en Leadgrid-selger inn
 * gjennom Role Room sin app, blir han bedt om tilgang av et produkt han
 * ikke bruker — og det er ikke en kosmetisk feil, det er å be om tilgang
 * under feil navn.
 *
 * Den farligste delen er callbacken: den er FELLES for begge produkter.
 * Koden må veksles inn med den samme klienten som utstedte den, ellers
 * avviser LinkedIn utvekslingen.
 */
import { describe, expect, it } from "vitest";
import { resolveLinkedInOauthClient } from "./linkedin-oauth-config.js";

const env = {
  LEADGRID_LINKEDIN_CLIENT_ID: "leadgrid-app",
  LEADGRID_LINKEDIN_CLIENT_SECRET: "leadgrid-hemmelig",
  ROLE_ROOM_LINKEDIN_CLIENT_ID: "roleroom-app",
  ROLE_ROOM_LINKEDIN_CLIENT_SECRET: "roleroom-hemmelig",
  LINKEDIN_CLIENT_ID: "delt-app",
  LINKEDIN_CLIENT_SECRET: "delt-hemmelig",
} as const;

describe("resolveLinkedInOauthClient", () => {
  it("gir Leadgrid sin app til Leadgrid", () => {
    const k = resolveLinkedInOauthClient("leadgrid", env);
    expect(k.clientId).toBe("leadgrid-app");
    expect(k.clientSecret).toBe("leadgrid-hemmelig");
  });

  it("gir Role Room sin app til Role Room", () => {
    expect(resolveLinkedInOauthClient("roleroom", env).clientId)
      .toBe("roleroom-app");
  });

  it("faller tilbake til den delte appen når produktet mangler nøkler", () => {
    // Uten dette ville innlogging brutt i det sekundet koden ble deployet,
    // før noen rakk å sette de nye variablene.
    const bare = { LINKEDIN_CLIENT_ID: "delt-app",
                   LINKEDIN_CLIENT_SECRET: "delt-hemmelig" } as const;
    expect(resolveLinkedInOauthClient("leadgrid", bare).clientId).toBe("delt-app");
    expect(resolveLinkedInOauthClient("roleroom", bare).clientId).toBe("delt-app");
  });

  it("blander ALDRI id fra ett produkt med hemmelighet fra et annet", () => {
    // Den verste feilen: LinkedIn avviser utvekslingen, og feilmeldingen
    // sier ingenting om hvorfor.
    const kunLeadgridId = {
      LEADGRID_LINKEDIN_CLIENT_ID: "leadgrid-app",
      ROLE_ROOM_LINKEDIN_CLIENT_SECRET: "roleroom-hemmelig",
    } as const;
    const k = resolveLinkedInOauthClient("leadgrid", kunLeadgridId);
    expect(k.clientSecret).toBeNull();
    expect(k.complete).toBe(false);
  });

  it("er ufullstendig uten hemmelighet", () => {
    expect(resolveLinkedInOauthClient("leadgrid",
      { LEADGRID_LINKEDIN_CLIENT_ID: "x" } as const).complete).toBe(false);
  });
});
