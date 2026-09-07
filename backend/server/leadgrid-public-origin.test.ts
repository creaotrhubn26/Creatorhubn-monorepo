import { describe, expect, it } from "vitest";

import {
  leadgridPublicOrigin,
  validatedPublicOrigin,
} from "./leadgrid-public-origin.js";

describe("Leadgrid public origin", () => {
  it("defaults only to the Leadgrid production origin", () => {
    expect(leadgridPublicOrigin({ LEADGRID_PUBLIC_URL: undefined })).toBe(
      "https://leadgrid.no",
    );
  });

  it("accepts HTTPS origins and strips a root slash", () => {
    expect(
      leadgridPublicOrigin({ LEADGRID_PUBLIC_URL: "https://app.leadgrid.no/" }),
    ).toBe("https://app.leadgrid.no");
  });

  it("allows HTTP only for local development", () => {
    expect(
      leadgridPublicOrigin({ LEADGRID_PUBLIC_URL: "http://localhost:5173" }),
    ).toBe("http://localhost:5173");
    expect(() =>
      leadgridPublicOrigin({ LEADGRID_PUBLIC_URL: "http://leadgrid.no" }),
    ).toThrow("må bruke HTTPS");
  });

  it("rejects paths, query strings, fragments and credentials", () => {
    for (const value of [
      "https://leadgrid.no/app",
      "https://leadgrid.no/?tenant=a",
      "https://leadgrid.no/#invite",
      "https://user:secret@leadgrid.no",
    ]) {
      expect(() =>
        validatedPublicOrigin("LEADGRID_PUBLIC_URL", value),
      ).toThrow("må være et origin");
    }
  });

  it("never consults a Role Room fallback", () => {
    const env = {
      LEADGRID_PUBLIC_URL: undefined,
      ROLE_ROOM_PUBLIC_URL: "https://theroleroom.com",
    };
    expect(leadgridPublicOrigin(env)).toBe("https://leadgrid.no");
  });
});
