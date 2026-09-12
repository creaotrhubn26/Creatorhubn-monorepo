import { describe, expect, it } from "vitest";

import { mapIprResponse } from "./lead-ip-service.js";

// Struktur fra faktisk API-respons (name=equinor, verifisert 2026-07-13)
const raw = {
  trademarkBagCount: 52,
  patentBagCount: 191,
  designBagCount: 0,
  trademarkBag: [
    {
      registrationNumber: "322530",
      markVerbalElementText: "equinor",
      applicationNumber: "201803723",
      currentStatusNo: "Registrert",
      currentStatusDate: "2022-06-22",
      caseUrl: "https://services.patentstyret.no/sak",
    },
    {
      applicationNumber: "202612345",
      currentStatusNo: "Under behandling",
      currentStatusDate: "2026-07-01",
    },
  ],
};

describe("mapIprResponse", () => {
  it("mapper tellinger og sorterer varemerker nyeste først", () => {
    const p = mapIprResponse(raw, "name")!;
    expect(p).toMatchObject({ matchedBy: "name", trademarks: 52, patents: 191, designs: 0 });
    expect(p.recentTrademarks[0].statusDate).toBe("2026-07-01");
    expect(p.recentTrademarks[0].text).toBe("(søknad 202612345)"); // uten merketekst — ærlig plassholder
    expect(p.recentTrademarks[1].text).toBe("equinor");
  });

  it("null når selskapet ikke har noen rettigheter — ingen nulliprofil", () => {
    expect(mapIprResponse({ trademarkBagCount: 0, patentBagCount: 0, designBagCount: 0 }, "orgnr")).toBeNull();
  });

  it("maks 5 ferske varemerker", () => {
    const many = { ...raw, trademarkBag: Array.from({ length: 9 }, (_, i) => ({ markVerbalElementText: `m${i}`, applicationNumber: `20260000${i}`, currentStatusDate: `2026-01-0${(i % 9) + 1}` })) };
    expect(mapIprResponse(many, "orgnr")!.recentTrademarks).toHaveLength(5);
  });
});
